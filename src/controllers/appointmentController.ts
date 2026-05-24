import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Appointment, ApiResponse } from "../types/appointment";
import {
  APPOINTMENT_TYPES,
  getAppointmentTypeName,
  getAppointmentPrice,
} from "../utils/appointment-types";
import { hasConflict } from "../utils/appointment-helpers";
import { normalizeAppointmentDuration } from "../utils/appointment-durations";
import {
  CART_APPOINTMENT_STATUS,
  isPatientCartStatus,
  normalizeStatus,
} from "../constants/appointmentStatuses";
import {
  notifyAppointmentChange,
  notifyStatusChange,
  notifyPaymentReceived,
  updateNotificationMetadata,
  resolveRecipients,
} from "../utils/notifications";
import { createAppointmentLog, getAppointmentLogs } from "../utils/appointmentLogs";
import { createPaymentLog, getPaymentLogs } from "../utils/paymentLogs";
import {
  getPastRestrictedAppointmentStatus,
  markPastAppointmentsAsTbd,
  readAppointmentsWithLifecycle,
} from "../utils/appointmentStatusLifecycle";
import { prisma } from "../lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production";
const PUBLIC_APPOINTMENT_TOKEN_SCOPE = "public_appointment";

// Backward compatibility for older public tokens issued before JWT public tokens.
const publicAccessTokens = new Map<string, string>();

const createPublicAppointmentToken = (appointmentId: string) =>
  jwt.sign(
    { scope: PUBLIC_APPOINTMENT_TOKEN_SCOPE, appointmentId },
    JWT_SECRET,
    { expiresIn: "90d" }
  );

const resolvePublicAppointmentToken = (token: string): string | null => {
  if (!token) return null;

  const legacyAppointmentId = publicAccessTokens.get(token);
  if (legacyAppointmentId) return legacyAppointmentId;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (
      decoded?.scope === PUBLIC_APPOINTMENT_TOKEN_SCOPE &&
      decoded?.appointmentId
    ) {
      return String(decoded.appointmentId);
    }
  } catch {
    return null;
  }

  return null;
};

const toAppointment = (appointment: unknown): Appointment => appointment as Appointment;

const isStaffRole = (req: Request): boolean => {
  const role = String((req as any).user?.role || "").toLowerCase();
  return role === "admin" || role === "doctor";
};

const isCashPaymentMethod = (method: unknown): boolean =>
  String(method || "").trim().toLowerCase() === "cash";

const appointmentData = (appointment: Appointment) => ({
  patientName: appointment.patientName,
  date: appointment.date,
  time: appointment.time,
  type: getAppointmentTypeName(appointment.type, appointment.customType),
  doctor: appointment.doctor,
  cancellationReason: appointment.cancellationReason,
});

const buildAppointmentCreateData = (appointment: Appointment) => {
  const basePrice = getAppointmentPrice(appointment.type);
  const discount = Number(appointment.discount) || 0;
  const price = appointment.price ?? basePrice;
  const status = getPastRestrictedAppointmentStatus(
    appointment.date,
    appointment.status || "scheduled"
  );

  return {
    id: `apt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    patientId: appointment.patientId,
    patientName: appointment.patientName,
    date: appointment.date,
    time: appointment.time,
    type: appointment.type,
    customType: appointment.customType || "",
    price,
    discount,
    doctor: appointment.doctor || "",
    duration: normalizeAppointmentDuration(appointment.duration),
    notes: appointment.notes || "",
    serviceType: appointment.serviceType || null,
    status,
    cancellationReason: appointment.cancellationReason || null,
    paymentStatus: appointment.paymentStatus || "unpaid",
    paymentMethod: appointment.paymentMethod || null,
    totalPaid: appointment.totalPaid || 0,
    balance: appointment.balance != null ? appointment.balance : Math.max(0, price - discount),
    transactions: appointment.transactions || null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false,
  };
};

const buildAppointmentUpdateData = (updates: Partial<Appointment>) => {
  const allowed = [
    "patientId",
    "patientName",
    "date",
    "time",
    "type",
    "customType",
    "price",
    "discount",
    "doctor",
    "duration",
    "notes",
    "serviceType",
    "status",
    "cancellationReason",
    "paymentStatus",
    "paymentMethod",
    "balance",
    "totalPaid",
    "transactions",
  ] as const;

  const data: Record<string, any> = {};
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      data[field] = (updates as any)[field];
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, "duration")) {
    data.duration = normalizeAppointmentDuration(data.duration);
  }
  data.updatedAt = new Date();
  return data;
};

const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = String(timeStr || "").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const normalizeDoctorName = (name: string) =>
  (name || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();

const REQUEST_APPOINTMENT_STATUSES = new Set(["reserved", "to-pay", "half-paid", "tbd"]);
const HISTORY_APPOINTMENT_STATUSES = new Set(["scheduled", "completed", "cancelled"]);

const getAppointmentSortValue = (appointment: Appointment, sortBy?: string): string | number => {
  switch (sortBy) {
    case "patient":
      return String(appointment.patientName || "").toLowerCase();
    case "service":
      return getAppointmentTypeName(appointment.type, appointment.customType).toLowerCase();
    case "doctor":
      return String(appointment.doctor || "").toLowerCase();
    case "status":
      return normalizeStatus(appointment.status);
    case "payment":
      return normalizeStatus(appointment.paymentStatus || "unpaid");
    case "booked":
      return appointment.createdAt ? new Date(appointment.createdAt).getTime() : Number.MIN_VALUE;
    case "updated":
      return appointment.updatedAt ? new Date(appointment.updatedAt).getTime() : Number.MIN_VALUE;
    case "date":
    default:
      return `${appointment.date || ""}T${appointment.time || ""}`;
  }
};

const sortAppointments = (
  appointments: Appointment[],
  sortBy?: string,
  sortDirection?: string
) => {
  const direction = sortDirection === "asc" ? "asc" : "desc";
  const column = sortBy || "date";

  return [...appointments].sort((a, b) => {
    const aVal = getAppointmentSortValue(a, column);
    const bVal = getAppointmentSortValue(b, column);

    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });
};

const cancelOverlappingPendingAppointments = async (
  appointments: Appointment[],
  newAppointment: Appointment,
  changedBy: string,
  changedByName?: string
) => {
  const normalizedNewStatus = normalizeStatus(newAppointment.status);
  if (isPatientCartStatus(normalizedNewStatus) || normalizedNewStatus === "cancelled") return;

  const newStart = timeToMinutes(newAppointment.time);
  const newEnd = newStart + normalizeAppointmentDuration(newAppointment.duration);
  const newDoctorNorm = normalizeDoctorName(newAppointment.doctor || "");

  for (const apt of appointments) {
    if (
      apt.deleted ||
      apt.id === newAppointment.id ||
      apt.date !== newAppointment.date ||
      !isPatientCartStatus(apt.status)
    ) {
      continue;
    }

    const isSamePatient = newAppointment.patientId && apt.patientId === newAppointment.patientId;
    const isSameDoctor =
      newDoctorNorm && normalizeDoctorName(apt.doctor || "") === newDoctorNorm;
    if (!isSamePatient && !isSameDoctor) continue;

    const aptStart = timeToMinutes(apt.time);
    const aptEnd = aptStart + normalizeAppointmentDuration(apt.duration);
    if (!(newStart < aptEnd && newEnd > aptStart) || !apt.id) continue;

    const previousState = { ...apt };
    apt.status = "cancelled";
    apt.updatedAt = new Date();

    await prisma.appointment.update({
      where: { id: apt.id },
      data: { status: "cancelled", updatedAt: apt.updatedAt },
    });

    await createAppointmentLog(
      apt.id,
      previousState,
      apt,
      changedBy,
      changedByName || "System",
      "status_change",
      0,
      `Automatically cancelled due to overlap with a ${newAppointment.status} appointment`
    );

    await notifyStatusChange(
      apt.id,
        "status",
        CART_APPOINTMENT_STATUS,
        "cancelled",
      await resolveRecipients(apt),
      appointmentData(apt)
    );
  }
};

export const addAppointment = async (
  req: Request,
  res: Response<ApiResponse<Appointment>>
) => {
  try {
    const appointments = await readAppointmentsWithLifecycle();
    const appointmentInput: Appointment = req.body;
    const isSeeding = req.body.isSeeding === true;

    const requestedStatus = getPastRestrictedAppointmentStatus(
      appointmentInput.date,
      appointmentInput.status || "scheduled"
    );

    if (!isSeeding && isStaffRole(req) && isPatientCartStatus(requestedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Admin and doctor users cannot create Add to Cart appointments.",
      });
    }
    if (!isSeeding && isCashPaymentMethod(appointmentInput.paymentMethod) && !isStaffRole(req)) {
      return res.status(403).json({
        success: false,
        message: "Cash payments can only be recorded by admins or doctors",
      });
    }

    if (
      !appointmentInput.patientId ||
      !appointmentInput.patientName ||
      !appointmentInput.date ||
      !appointmentInput.time ||
      appointmentInput.type == null ||
      appointmentInput.type < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: patientId, patientName, date, time, type",
      });
    }

    appointmentInput.duration = normalizeAppointmentDuration(appointmentInput.duration);

    if (
      !isSeeding &&
      hasConflict(
        appointments,
        appointmentInput.date,
        appointmentInput.time,
        appointmentInput.duration,
        appointmentInput.doctor || "",
        undefined,
        appointmentInput.patientId
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "Conflict detected: Either the doctor or the patient is already busy during this time.",
      });
    }

    if (appointmentInput.type === APPOINTMENT_TYPES.length - 1 && !appointmentInput.customType) {
      return res.status(400).json({
        success: false,
        message: "Custom type description is required when 'Other' is selected.",
      });
    }

    const createData = buildAppointmentCreateData(appointmentInput);
    const newAppointment = toAppointment(createData);
    const changedBy = (req as any).user?.id || (req as any).user?.username || "admin";
    const changedByName =
      (req as any).user?.name ||
      (req as any).user?.username ||
      (changedBy === "admin" ? "Admin" : changedBy);

    await cancelOverlappingPendingAppointments(appointments, newAppointment, changedBy, changedByName);

    const created = toAppointment(await prisma.appointment.create({ data: createData as any }));
    await notifyAppointmentChange(created, "created");

    const recipients = await resolveRecipients(created);
    if (created.paymentStatus && created.paymentStatus !== "unpaid") {
      await notifyStatusChange(
        created.id || "",
        "payment",
        "unpaid",
        created.paymentStatus,
        recipients,
        appointmentData(created)
      );
    }

    await createAppointmentLog(
      created.id!,
      { status: "none", paymentStatus: "none", price: 0, balance: 0, totalPaid: 0 } as any,
      created,
      changedBy,
      changedByName,
      "update",
      created.totalPaid || 0,
      created.notes
    );

    if (created.totalPaid && created.totalPaid > 0) {
      await createPaymentLog(
        created.id!,
        created.totalPaid,
        created.paymentMethod || "cash",
        created.paymentStatus || "unpaid",
        changedBy,
        created.price || 0,
        created.balance || 0,
        changedByName
      );
      await notifyPaymentReceived(
        created.id || "",
        created.totalPaid,
        recipients,
        appointmentData(created),
        `initial_${created.id}`
      );
    }

    res.status(201).json({
      success: true,
      message: "Appointment added successfully",
      data: created,
    });
  } catch (error) {
    console.error("[APPOINTMENT CREATE] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error adding appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAppointments = async (
  req: Request,
  res: Response<ApiResponse<Appointment[]>>
) => {
  try {
    const appointments = await readAppointmentsWithLifecycle();
    const {
      startDate,
      endDate,
      search,
      doctor,
      type,
      status,
      patientId,
      parentId,
      anonymize,
      includeUnpaid,
      matchType,
      view,
      page,
      limit,
      sortBy,
      sortDirection,
    } = req.query as Record<string, string>;
    const shouldPaginate = Boolean(page || limit);
    const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit || "20", 10) || 20));

    let filtered = appointments.filter((appointment) => !appointment.deleted);

    if (isStaffRole(req)) {
      filtered = filtered.filter((appointment) => !isPatientCartStatus(appointment.status));
      if (isPatientCartStatus(status)) filtered = [];
    }

    if (includeUnpaid !== "true" && !isPatientCartStatus(status)) {
      filtered = filtered.filter((appointment) => !isPatientCartStatus(appointment.status));
    }

    const isGlobal = anonymize === "true";

    if (startDate) filtered = filtered.filter((appointment) => appointment.date >= startDate);
    if (endDate) filtered = filtered.filter((appointment) => appointment.date <= endDate);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (appointment) =>
          appointment.patientName.toLowerCase().includes(q) ||
          getAppointmentTypeName(appointment.type, appointment.customType).toLowerCase().includes(q) ||
          String(appointment.doctor || "").toLowerCase().includes(q)
      );
    } else if (matchType === "or" && (doctor || patientId || parentId)) {
      let familyIds: string[] = [];
      if (parentId && !isGlobal) {
        const patients = await prisma.patient.findMany({
          where: { deleted: false, OR: [{ parentId }, { id: parentId }] },
          select: { id: true },
        });
        familyIds = patients.map((patient) => patient.id);
      }

      filtered = filtered.filter((appointment) => {
        if (doctor && doctor !== "all" && appointment.doctor === doctor) return true;
        if (!isGlobal && patientId && appointment.patientId === patientId) return true;
        if (!isGlobal && parentId && familyIds.includes(appointment.patientId)) return true;
        return false;
      });
    } else {
      if (parentId && !isGlobal) {
        const patients = await prisma.patient.findMany({
          where: { deleted: false, OR: [{ parentId }, { id: parentId }] },
          select: { id: true },
        });
        const familyIds = new Set(patients.map((patient) => patient.id));
        filtered = filtered.filter((appointment) => familyIds.has(appointment.patientId));
      } else if (patientId && !isGlobal) {
        filtered = filtered.filter((appointment) => appointment.patientId === patientId);
      }

      if (doctor && doctor !== "all") {
        filtered = filtered.filter((appointment) => appointment.doctor === doctor);
      }
    }

    if (type && type !== "all") {
      filtered = filtered.filter((appointment) => appointment.type === parseInt(type, 10));
    }
    if (view === "requests") {
      filtered = filtered.filter((appointment) =>
        REQUEST_APPOINTMENT_STATUSES.has(normalizeStatus(appointment.status))
      );
    } else if (view === "history") {
      filtered = filtered.filter((appointment) =>
        HISTORY_APPOINTMENT_STATUSES.has(normalizeStatus(appointment.status))
      );
    }
    if (status && status !== "all") {
      filtered = filtered.filter(
        (appointment) =>
          (includeUnpaid === "true" &&
            (appointment.paymentStatus === "unpaid" ||
              isPatientCartStatus(appointment.status) ||
              normalizeStatus(appointment.status) === "tbd")) ||
          normalizeStatus(appointment.status) === normalizeStatus(status)
      );
    }

    if (isGlobal) {
      filtered = filtered.map((appointment) => ({
        ...appointment,
        patientName: "Occupied",
        patientId: "Occupied",
        notes: "",
        price: 0,
        balance: 0,
        totalPaid: 0,
        customType: appointment.type === APPOINTMENT_TYPES.length - 1 ? "Other" : "",
      }));
    }

    if (sortBy || view || shouldPaginate) {
      filtered = sortAppointments(filtered, sortBy || (view === "requests" ? "booked" : "date"), sortDirection);
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const pageData = shouldPaginate
      ? filtered.slice((pageNum - 1) * limitNum, (pageNum - 1) * limitNum + limitNum)
      : filtered;
    const patientIds = Array.from(
      new Set(pageData.map((appointment) => appointment.patientId).filter(Boolean))
    );
    const patientProfiles = isGlobal || patientIds.length === 0
      ? new Map<string, string | null>()
      : new Map(
          (
            await prisma.patient.findMany({
              where: { id: { in: patientIds }, deleted: false },
              select: { id: true, profilePicture: true },
            })
          ).map((patient) => [patient.id, patient.profilePicture || null])
        );

    const response: ApiResponse<Appointment[]> = {
      success: true,
      message: "Appointments retrieved successfully",
      data: pageData.map((appointment) => ({
        ...appointment,
        patientProfile: patientProfiles.get(appointment.patientId) || null,
        patientProfilePicture: patientProfiles.get(appointment.patientId) || null,
        profilePicture: patientProfiles.get(appointment.patientId) || null,
        patient: {
          id: appointment.patientId,
          profilePicture: patientProfiles.get(appointment.patientId) || null,
        },
        status: normalizeStatus(appointment.status),
      })),
    };

    if (shouldPaginate) {
      response.meta = { total, page: pageNum, limit: limitNum, totalPages };
    }

    res.json(response);
  } catch (error) {
    console.error("[APPOINTMENT GET_ALL] Error fetching appointments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching appointments",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getPublicAppointmentAvailability = async (
  req: Request,
  res: Response<ApiResponse<Appointment[]>>
) => {
  try {
    const appointments = await readAppointmentsWithLifecycle();
    const { startDate, endDate, doctor } = req.query as Record<string, string>;

    let filtered = appointments.filter((appointment) => !appointment.deleted);

    if (startDate) filtered = filtered.filter((appointment) => appointment.date >= startDate);
    if (endDate) filtered = filtered.filter((appointment) => appointment.date <= endDate);
    if (doctor && doctor !== "all") {
      const requestedDoctor = normalizeDoctorName(doctor);
      filtered = filtered.filter(
        (appointment) => normalizeDoctorName(appointment.doctor || "") === requestedDoctor
      );
    }

    filtered = filtered.filter((appointment) => {
      const status = normalizeStatus(appointment.status);
      return status !== "cancelled" && !isPatientCartStatus(status);
    });

    res.json({
      success: true,
      message: "Public appointment availability retrieved successfully",
      data: filtered.map((appointment) => ({
        ...appointment,
        patientName: "Occupied",
        patientId: "Occupied",
        notes: "",
        price: 0,
        balance: 0,
        totalPaid: 0,
        status: normalizeStatus(appointment.status),
      })),
    });
  } catch (error) {
    console.error("[PUBLIC APPOINTMENT AVAILABILITY] Error fetching appointments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching public appointment availability",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAppointmentById = async (
  req: Request,
  res: Response<ApiResponse<Appointment | null>>
) => {
  try {
    const appointment = toAppointment(
      await prisma.appointment.findUnique({ where: { id: req.params.id } })
    );

    if (!appointment || appointment.deleted) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    await markPastAppointmentsAsTbd([appointment]);

    if (isStaffRole(req) && isPatientCartStatus(appointment.status)) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    res.json({
      success: true,
      message: "Appointment retrieved successfully",
      data: { ...appointment, status: normalizeStatus(appointment.status) },
    });
  } catch (error) {
    console.error("[APPOINTMENT GET_BY_ID] Error fetching appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateAppointment = async (
  req: Request,
  res: Response<ApiResponse<Appointment | null>>
) => {
  try {
    const appointments = await readAppointmentsWithLifecycle();
    const { id } = req.params;
    const updates: Partial<Appointment> = req.body;

    const oldAppointment = appointments.find((appointment) => appointment.id === id);
    if (!oldAppointment || (isStaffRole(req) && isPatientCartStatus(oldAppointment.status))) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
    if (
      Object.prototype.hasOwnProperty.call(updates, "paymentMethod") &&
      isCashPaymentMethod(updates.paymentMethod) &&
      !isStaffRole(req)
    ) {
      return res.status(403).json({
        success: false,
        message: "Cash payments can only be recorded by admins or doctors",
      });
    }

    const derivedTotalPaid =
      oldAppointment.totalPaid !== undefined
        ? oldAppointment.totalPaid
        : oldAppointment.price !== undefined && oldAppointment.balance !== undefined
          ? Math.max(0, oldAppointment.price - (oldAppointment.discount || 0) - oldAppointment.balance)
          : 0;

    const updatedAppointment: Appointment = {
      ...oldAppointment,
      totalPaid: derivedTotalPaid,
      ...updates,
      id: oldAppointment.id,
      updatedAt: new Date(),
    };
    updatedAppointment.duration = normalizeAppointmentDuration(updatedAppointment.duration);
    if (updates.duration !== undefined) {
      updates.duration = updatedAppointment.duration;
    }
    const restrictedStatus = getPastRestrictedAppointmentStatus(
      updatedAppointment.date,
      updatedAppointment.status
    );
    if (restrictedStatus !== updatedAppointment.status) {
      updatedAppointment.status = restrictedStatus;
      updates.status = restrictedStatus;
    }
    if (isStaffRole(req) && isPatientCartStatus(updatedAppointment.status)) {
      return res.status(400).json({
        success: false,
        message: "Admin and doctor users cannot set appointments to Add to Cart.",
      });
    }

    if (updates.date || updates.time || updates.duration !== undefined || updates.doctor) {
      if (
        hasConflict(
          appointments,
          updatedAppointment.date,
          updatedAppointment.time,
          updatedAppointment.duration,
          updatedAppointment.doctor || "",
          id,
          updatedAppointment.patientId
        )
      ) {
        return res.status(409).json({
          success: false,
          message: "Conflict detected: Either the doctor or the patient is already busy during this time.",
        });
      }
    }

    if ((updates as any).price !== undefined || (updates as any).discount !== undefined) {
      const price = updatedAppointment.price || 0;
      const discount = (updatedAppointment as any).discount || 0;
      updatedAppointment.balance = Math.max(0, price - discount - (updatedAppointment.totalPaid || 0));
    }

    const changedBy = (req as any).user?.id || (req as any).user?.username || "admin";
    const changedByName =
      (req as any).user?.name ||
      (req as any).user?.username ||
      (changedBy === "admin" ? "Admin" : changedBy);
    await cancelOverlappingPendingAppointments(appointments, updatedAppointment, changedBy, changedByName);

    const oldStatus = normalizeStatus(oldAppointment.status);
    const oldPaymentStatus = oldAppointment.paymentStatus || "unpaid";
    const oldTotalPaidValue = derivedTotalPaid || 0;
    const newTotalPaidValue = updatedAppointment.totalPaid || 0;
    const paymentAmount = newTotalPaidValue - oldTotalPaidValue;

    let logChangeType: any = "update";
    if (paymentAmount > 0) logChangeType = "payment";
    else if (updates.status && updates.status !== oldStatus) logChangeType = "status_change";
    else if ((updates.date && updates.date !== oldAppointment.date) || (updates.time && updates.time !== oldAppointment.time)) logChangeType = "rescheduled";
    else if (updates.notes !== undefined && updates.notes !== oldAppointment.notes) logChangeType = "notes_update";
    else if (updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus) logChangeType = "payment";

    await createAppointmentLog(id, oldAppointment, updatedAppointment, changedBy, changedByName, logChangeType, paymentAmount, updates.notes);

    if (paymentAmount > 0 || (updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus)) {
      await createPaymentLog(
        id,
        paymentAmount > 0 ? paymentAmount : 0,
        updatedAppointment.paymentMethod || "cash",
        updatedAppointment.paymentStatus || "unpaid",
        changedBy,
        oldAppointment.balance || 0,
        updatedAppointment.balance || 0,
        changedByName
      );
    }

    const saved = toAppointment(
      await prisma.appointment.update({
        where: { id },
        data: buildAppointmentUpdateData(updatedAppointment) as any,
      })
    );

    const recipients = await resolveRecipients(saved);

    if (paymentAmount > 0) {
      await notifyPaymentReceived(saved.id || "", paymentAmount, recipients, appointmentData(saved), `update_${saved.id}_${Date.now()}`);
    }

    if (updates.status) {
      await notifyStatusChange(saved.id || "", "status", oldStatus, updates.status, recipients, appointmentData(saved));
    }

    if (updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus) {
      await notifyStatusChange(saved.id || "", "payment", oldPaymentStatus, updates.paymentStatus, recipients, appointmentData(saved));
    }

    if (!updates.status && !updates.paymentStatus) {
      const detailFieldsChanged =
        updates.date ||
        updates.time ||
        updates.duration !== undefined ||
        updates.doctor ||
        updates.type !== undefined ||
        updates.customType ||
        updates.notes;

      if (detailFieldsChanged && saved.id) {
        await Promise.all(
          recipients.map((userId) =>
            updateNotificationMetadata(userId, saved.id!, {
              message: `Your appointment on ${saved.date} at ${saved.time} has been updated.`,
              metadata: {
                appointmentDate: saved.date,
                appointmentTime: saved.time,
                changedFields: {
                  date: updates.date,
                  time: updates.time,
                  doctor: updates.doctor,
                  notes: updates.notes,
                  updatedAt: new Date().toISOString(),
                },
              },
            })
          )
        );
      }
    }

    res.json({
      success: true,
      message: "Appointment updated successfully",
      data: saved,
    });
  } catch (error) {
    console.error("[APPOINTMENT UPDATE] Error updating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error updating appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteAppointment = async (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const appointment = toAppointment(
      await prisma.appointment.findUnique({ where: { id: req.params.id } })
    );

    if (!appointment || (isStaffRole(req) && isPatientCartStatus(appointment.status))) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    await prisma.appointment.update({
      where: { id: req.params.id },
      data: { deleted: true, deletedAt: new Date(), updatedAt: new Date() },
    });

    if (appointment.id) {
      await notifyStatusChange(
        appointment.id,
        "status",
        normalizeStatus(appointment.status),
        "cancelled",
        await resolveRecipients(appointment),
        appointmentData(appointment)
      );
    }

    res.json({ success: true, message: "Appointment soft-deleted successfully" });
  } catch (error) {
    console.error("[APPOINTMENT DELETE] Error deleting appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const bookPublicAppointment = async (
  req: Request,
  res: Response<ApiResponse<Appointment>>
) => {
  try {
    const appointments = await readAppointmentsWithLifecycle();
    const {
      firstName,
      lastName,
      email,
      phone,
      date,
      time,
      duration,
      type,
      customType,
      doctor,
      notes,
      patientId,
      serviceType,
      // Optional fields that public callers may provide when paying or confirming
      status: requestedStatusFromClient,
      paymentStatus: paymentStatusFromClient,
      totalPaid: totalPaidFromClient,
      paymentMethod: paymentMethodFromClient,
      price: clientPrice,
      discount: clientDiscount,
    } = req.body;

    if (!firstName || !lastName || !phone || !date || !time || type == null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: firstName, lastName, phone, date, time, type",
      });
    }
    if (isCashPaymentMethod(paymentMethodFromClient)) {
      return res.status(403).json({
        success: false,
        message: "Cash payments can only be recorded by admins or doctors",
      });
    }

    let patient = patientId
      ? await prisma.patient.findUnique({ where: { id: patientId } })
      : await prisma.patient.findFirst({
          where: {
            deleted: false,
            OR: [{ phone }, ...(email ? [{ email }] : [])],
          },
        });

    if (!patient) {
      const passwordHash = await bcrypt.hash("villahermosa123", 10);
      const newPatientId = `patient_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      patient = await prisma.patient.create({
        data: {
          id: newPatientId,
          name: `${firstName} ${lastName}`,
          firstName,
          lastName,
          email: email || "",
          phone,
          password: passwordHash,
          parentId: null,
          isPrimary: true,
          dateOfBirth: "",
          address: "",
          city: "",
          zipCode: "",
          emergencyContact: "",
          emergencyPhone: "",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          deleted: false,
        },
      });
    }

    // Determine the status the appointment should have, defaulting to cart.
    const requestedStatus = getPastRestrictedAppointmentStatus(
      date,
      String(requestedStatusFromClient || CART_APPOINTMENT_STATUS)
    );

    // Conflict check
    const appointmentDuration = normalizeAppointmentDuration(duration);

    if (hasConflict(appointments, date, time, appointmentDuration, doctor || "")) {
      return res.status(409).json({
        success: false,
        message: "The selected time is no longer available. Please choose another time.",
      });
    }

    // Build appointment input and create data using helper to keep shapes consistent
    const appointmentInput: Appointment = {
      id: "",
      patientId: patient.id,
      patientName: `${patient.firstName || firstName} ${patient.lastName || lastName}`.trim(),
      date,
      time,
      duration: appointmentDuration,
      type,
      customType: customType || "",
      price: clientPrice ?? getAppointmentPrice(type),
      discount: clientDiscount ?? 0,
      doctor: doctor || "",
      notes: notes || "",
      serviceType: serviceType || "",
      status: requestedStatus,
      cancellationReason: null,
      paymentStatus: paymentStatusFromClient || "unpaid",
      paymentMethod: paymentMethodFromClient || null,
      totalPaid: totalPaidFromClient || 0,
      balance:
        (clientPrice ?? getAppointmentPrice(type)) - (clientDiscount ?? 0) - (totalPaidFromClient || 0),
      transactions: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    } as any;

    const createData = buildAppointmentCreateData(appointmentInput as Appointment);
    const newAppointment = toAppointment(createData);

    // If the new appointment is not a cart item, cancel overlapping cart appointments.
    const normalizedNewStatus = normalizeStatus(newAppointment.status);
    if (!isPatientCartStatus(normalizedNewStatus) && normalizedNewStatus !== "cancelled") {
      await cancelOverlappingPendingAppointments(appointments, newAppointment, "patient", `${firstName} ${lastName}`);
    }

    const created = toAppointment(await prisma.appointment.create({ data: createData as any }));

    await notifyAppointmentChange(created, "public_request");

    await createAppointmentLog(
      created.id!,
      { status: "none", paymentStatus: "none", price: 0, balance: 0, totalPaid: 0 } as any,
      created,
      "patient",
      `${firstName} ${lastName}`,
      "update",
      created.totalPaid || 0,
      created.notes
    );

    if (created.totalPaid && created.totalPaid > 0) {
      await createPaymentLog(
        created.id!,
        created.totalPaid,
        created.paymentMethod || "cash",
        created.paymentStatus || "unpaid",
        "patient",
        created.price || 0,
        created.balance || 0,
        `${firstName} ${lastName}`
      );
      await notifyPaymentReceived(
        created.id || "",
        created.totalPaid,
        await resolveRecipients(created),
        appointmentData(created),
        `initial_${created.id}`
      );
    }

    // Generate a public token so the patient can fetch logs/payments for this appointment
    try {
      const token = createPublicAppointmentToken(created.id!);
      publicAccessTokens.set(token, created.id!);
      const response = { ...created, publicToken: token, publicAccessToken: token } as (typeof created) & {
        publicToken: string;
        publicAccessToken: string;
      };
      return res.status(201).json({
        success: true,
        message: "Appointment requested successfully.",
        data: response,
      });
    } catch (err) {
      console.warn("Failed to generate public token for appointment", err);
      res.status(201).json({
        success: true,
        message: "Appointment requested successfully.",
        data: created,
      });
    }
  } catch (error) {
    console.error("[PUBLIC BOOKING] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error processing your appointment request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const fetchAppointmentLogs = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Appointment ID is required" });
    // attempt to populate req.user from auth token (if present)
    try {
      const authToken = (req as any).cookies?.authToken || (req.headers.authorization || "").split(" ")[1];
      if (authToken) {
        try {
          (req as any).user = jwt.verify(authToken, JWT_SECRET);
        } catch (e) {
          // ignore invalid token
        }
      }
    } catch {
      // ignore auth cookie/header parsing failures
    }

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment || appointment.deleted) return res.status(404).json({ success: false, message: "Appointment not found" });

    const publicToken = String(req.query.publicToken || req.headers["x-public-token"] || "");
    const authUser = (req as any).user;
    const isAllowed =
      isStaffRole(req) || // staff can always view
      (authUser && (authUser.id === appointment.patientId || authUser.patientId === appointment.patientId)) || // owning patient
      resolvePublicAppointmentToken(publicToken) === id;

    if (!isAllowed) return res.status(403).json({ success: false, message: "Not authorized to view logs" });

    const logs = await getAppointmentLogs(id);
    res.json({ success: true, message: "Appointment logs retrieved successfully", data: logs });
  } catch (error) {
    console.error("[APPOINTMENT LOGS GET] Error fetching logs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching logs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const fetchPaymentLogs = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Appointment ID is required" });
    // attempt to populate req.user from auth token (if present)
    try {
      const authToken = (req as any).cookies?.authToken || (req.headers.authorization || "").split(" ")[1];
      if (authToken) {
        try {
          (req as any).user = jwt.verify(authToken, JWT_SECRET);
        } catch (e) {
          // ignore invalid token
        }
      }
    } catch {
      // ignore auth cookie/header parsing failures
    }

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment || appointment.deleted) return res.status(404).json({ success: false, message: "Appointment not found" });

    const publicToken = String(req.query.publicToken || req.headers["x-public-token"] || "");
    const authUser = (req as any).user;
    const isAllowed =
      isStaffRole(req) || // staff can always view
      (authUser && (authUser.id === appointment.patientId || authUser.patientId === appointment.patientId)) || // owning patient
      resolvePublicAppointmentToken(publicToken) === id;

    if (!isAllowed) return res.status(403).json({ success: false, message: "Not authorized to view logs" });

    const logs = await getPaymentLogs(id);
    res.json({ success: true, message: "Payment logs retrieved successfully", data: logs });
  } catch (error) {
    console.error("[PAYMENT LOGS GET] Error fetching logs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching logs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
