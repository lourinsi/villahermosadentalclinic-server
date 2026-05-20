import { Notification } from "../types/notification";
import { NotificationType } from "../shared/notificationStatuses";
import { getAppointmentTypeName } from "./appointment-types";
import { prisma } from "../lib/prisma";
import { isPatientCartStatus, normalizeStatus } from "../constants/appointmentStatuses";

console.log("[notifications] SYSTEM LOADED - Prisma-backed");

const toNotification = (notification: any): Notification => ({
  ...notification,
  createdAt: notification.createdAt?.toISOString?.() || notification.createdAt || new Date().toISOString(),
  updatedAt: notification.updatedAt?.toISOString?.() || notification.updatedAt || undefined,
  deletedAt: notification.deletedAt?.toISOString?.() || notification.deletedAt || undefined,
  metadata: notification.metadata as Notification["metadata"],
  type: notification.type as NotificationType,
});

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  metadata?: Notification["metadata"]
): Promise<Notification> => {
  const created = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      metadata: metadata as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      isRead: false,
      deleted: false,
      isLog: false,
    },
  });

  return toNotification(created);
};

export const updateOrCreateNotificationForAppointment = async (
  userId: string,
  appointmentId: string,
  details: {
    title: string;
    message: string;
    type: NotificationType;
    metadata: Notification["metadata"];
  }
): Promise<Notification> => {
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId,
      type: details.type,
      isLog: false,
      metadata: {
        path: ["appointmentId"],
        equals: appointmentId,
      },
    },
  });

  if (existingNotification) {
    const updated = await prisma.notification.update({
      where: { id: existingNotification.id },
      data: {
        title: details.title,
        message: details.message,
        type: details.type,
        metadata: details.metadata as any,
        isRead: false,
        updatedAt: new Date(),
        deleted: false,
        deletedAt: null,
      },
    });
    return toNotification(updated);
  }

  return createNotification(userId, details.title, details.message, details.type, details.metadata);
};

export const notifyAdmin = async (
  title: string,
  message: string,
  type: NotificationType,
  metadata?: Notification["metadata"]
) => {
  if (metadata?.appointmentId) {
    await updateOrCreateNotificationForAppointment("admin", metadata.appointmentId, {
      title,
      message,
      type,
      metadata,
    });
    return;
  }

  await createNotification("admin", title, message, type, metadata);
};

const formatDoctorName = (name?: string): string => {
  if (!name) return "";
  const cleanName = name.replace(/^Dr\.\s+/i, "");
  return `Dr. ${cleanName}`;
};

export const resolveRecipients = async (appointment: any): Promise<string[]> => {
  const recipients = new Set<string>();

  if (appointment.patientId) {
    recipients.add(appointment.patientId);
  }

  if (appointment.doctor) {
    const searchName = String(appointment.doctor).toLowerCase().trim();
    const doctor = await prisma.staff.findFirst({
      where: { deleted: false },
    }).then(async () => {
      const staff = await prisma.staff.findMany({ where: { deleted: false } });
      return staff.find((s) => {
        const staffName = s.name.toLowerCase().trim();
        return (
          staffName === searchName ||
          staffName.replace(/^dr\.\s+/i, "") === searchName.replace(/^dr\.\s+/i, "")
        );
      });
    });

    if (doctor?.id) {
      recipients.add(doctor.id);
    }
  }

  recipients.add("admin");
  return Array.from(recipients).filter(Boolean);
};

export const notifyAppointmentChange = async (
  appointment: any,
  actionType: "created" | "updated" | "public_request",
  context?: { oldStatus?: string; changedFields?: { [key: string]: any } }
) => {
  const normalizedStatus = normalizeStatus(appointment.status);
  if (isPatientCartStatus(normalizedStatus)) return;

  const serviceName = getAppointmentTypeName(appointment.type, appointment.customType);
  const isRequest = ["reserved", "to-pay", "half-paid", "tbd"].includes(normalizedStatus);
  const recipients = new Map<
    string,
    { title: string; message: string; isDoctor?: boolean; isAdmin?: boolean; isPatient?: boolean }
  >();

  if (appointment.patientId) {
    let title = "Appointment Update";
    let message = `Your appointment for ${serviceName} on ${appointment.date} is now ${appointment.status}.`;

    if (actionType === "created") {
      title = "Appointment Scheduled";
      message = `Your appointment for ${serviceName} is scheduled for ${appointment.date} at ${appointment.time}.`;
    } else if (actionType === "public_request") {
      title = "Appointment Request Received";
      message = `Your request for a ${serviceName} appointment on ${appointment.date} at ${appointment.time} has been received and is awaiting confirmation.`;
    } else if (context?.changedFields?.date || context?.changedFields?.time) {
      title = "Appointment Updated";
      message = `Your appointment for ${serviceName} has been updated to ${appointment.date} at ${appointment.time}.`;
    }

    recipients.set(appointment.patientId, { title, message, isPatient: true });
  }

  if (appointment.doctor) {
    const staff = await prisma.staff.findMany({ where: { deleted: false } });
    const doctor = staff.find((s) => s.name === appointment.doctor);
    if (doctor?.id) {
      recipients.set(doctor.id, {
        title: isRequest ? "New Appointment Request" : "Appointment Update",
        message: `${appointment.patientName} has a ${appointment.status} appointment for ${serviceName} on ${appointment.date} at ${appointment.time}.`,
        isDoctor: true,
      });
    }
  }

  if (!recipients.has("admin")) {
    const doctorText = appointment.doctor ? ` with ${formatDoctorName(appointment.doctor)}` : "";
    recipients.set("admin", {
      title: isRequest ? "New Appointment Request" : "Appointment Update",
      message: `${appointment.patientName} has a ${appointment.status} appointment${doctorText} for ${serviceName} on ${appointment.date} at ${appointment.time}.`,
      isAdmin: true,
    });
  }

  await Promise.all(
    Array.from(recipients.entries()).map(([userId, data]) =>
      updateOrCreateNotificationForAppointment(userId, appointment.id, {
        title: data.title,
        message: data.message,
        type: "appointment",
        metadata: {
          appointmentId: appointment.id,
          currentStatus: appointment.status,
          patientName: appointment.patientName,
          appointmentDate: appointment.date,
          appointmentTime: appointment.time,
          isRequest,
          isDoctorView: data.isDoctor,
          isAdminView: data.isAdmin,
          isPatientView: data.isPatient,
          changedFields: context?.changedFields,
        },
      })
    )
  );
};

export const createStatusChangeNotification = async (
  userId: string,
  appointmentId: string,
  changeDetails: {
    oldStatus?: string;
    newStatus?: string;
    oldPaymentStatus?: string;
    newPaymentStatus?: string;
  },
  appointmentData: {
    patientName: string;
    date: string;
    time: string;
    type: string;
    doctor?: string;
    cancellationReason?: string;
  },
  amount?: number
) => {
  const { oldStatus, newStatus, oldPaymentStatus, newPaymentStatus } = changeDetails;
  const { patientName, date, time, type, doctor, cancellationReason } = appointmentData;
  const docName = formatDoctorName(doctor);
  const doctorWithSuffix = docName ? ` with ${docName}` : "";
  const isAdmin = userId === "admin";
  const isDoctor = userId.startsWith("staff_");

  let title = "Appointment Updated";
  let message = "";
  let notificationType: NotificationType = "appointment";

  let subjectText = `Your appointment${doctorWithSuffix}`;
  if (isAdmin) subjectText = `${patientName}'s appointment${doctorWithSuffix}`;
  else if (isDoctor) subjectText = `${patientName}'s appointment`;

  if (newStatus) {
    title = "Appointment Status Changed";
    message =
      newStatus === "cancelled" && cancellationReason
        ? `${subjectText} for ${type} on ${date} has been cancelled. Reason: ${cancellationReason}`
        : `${subjectText} for ${type} on ${date} is now ${newStatus}.`;
  } else if (newPaymentStatus) {
    title = "Payment Status Updated";
    notificationType = "payment";
    const amountText = amount ? ` of PHP ${amount.toLocaleString()}` : "";
    let paymentSubjectText = `The payment status for your ${type} appointment${doctorWithSuffix}`;
    if (isAdmin) paymentSubjectText = `The payment status for ${patientName}'s ${type} appointment${doctorWithSuffix}`;
    else if (isDoctor) paymentSubjectText = `The payment status for ${patientName}'s ${type} appointment`;
    message = `${paymentSubjectText}${amountText} on ${date} is now ${newPaymentStatus}.`;
  }

  await createNotification(userId, title, message, notificationType, {
    appointmentId,
    currentStatus: newStatus || oldStatus,
    patientName,
    appointmentDate: date,
    appointmentTime: time,
    doctor: docName,
    amount,
    cancellationReason,
    changedFields: {
      ...(oldStatus && newStatus && { status: { from: oldStatus, to: newStatus } }),
      ...(oldPaymentStatus && newPaymentStatus && {
        paymentStatus: { from: oldPaymentStatus, to: newPaymentStatus },
      }),
      changedAt: new Date().toISOString(),
    },
  });
};

export const updateNotificationMetadata = async (
  userId: string,
  appointmentId: string,
  updates: {
    title?: string;
    message?: string;
    metadata?: Partial<Notification["metadata"]>;
  }
) => {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      isLog: false,
      metadata: { path: ["appointmentId"], equals: appointmentId },
    },
  });

  if (!existing) return;

  await prisma.notification.update({
    where: { id: existing.id },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.message && { message: updates.message }),
      metadata: {
        ...((existing.metadata as Record<string, unknown>) || {}),
        ...updates.metadata,
      },
      updatedAt: new Date(),
    },
  });
};

export const archiveNotificationAsLog = async (
  userId: string,
  appointmentId: string,
  type?: NotificationType
) => {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      isLog: false,
      ...(type ? { type } : {}),
      metadata: { path: ["appointmentId"], equals: appointmentId },
    },
  });

  await Promise.all(
    notifications.map((notification) =>
      prisma.notification.update({
        where: { id: notification.id },
        data: { isLog: true, isRead: true, updatedAt: new Date() },
      })
    )
  );
};

export const notifyStatusChange = async (
  appointmentId: string,
  changeType: "status" | "payment",
  oldValue: string,
  newValue: string,
  recipientUserIds: string[],
  appointmentData: {
    patientName: string;
    date: string;
    time: string;
    type: string;
    doctor?: string;
    cancellationReason?: string;
  },
  amount?: number
) => {
  await Promise.all(
    recipientUserIds.map(async (userId) => {
      if (changeType === "status") {
        await archiveNotificationAsLog(userId, appointmentId, "appointment");
        await createStatusChangeNotification(
          userId,
          appointmentId,
          { oldStatus: oldValue, newStatus: newValue },
          appointmentData
        );
      } else {
        await createStatusChangeNotification(
          userId,
          appointmentId,
          { oldPaymentStatus: oldValue, newPaymentStatus: newValue },
          appointmentData,
          amount
        );
      }
    })
  );
};

export const notifyPaymentReceived = async (
  appointmentId: string,
  amount: number,
  recipients: string[],
  appointmentData: {
    patientName: string;
    date: string;
    time: string;
    type: string;
    doctor?: string;
  },
  paymentId?: string
) => {
  const { patientName, date, type, doctor } = appointmentData;
  const formattedAmount = `PHP ${amount.toLocaleString()}`;

  await Promise.all(
    recipients.map((userId) => {
      const isAdmin = userId === "admin";
      const isDoctor = userId.startsWith("staff_");
      const docName = formatDoctorName(doctor);
      const doctorWithSuffix = docName ? ` with ${docName}` : "";

      let title = "Payment Received";
      let message = `We've received a payment of ${formattedAmount} for your ${type} appointment${doctorWithSuffix} on ${date}.`;

      if (isAdmin) {
        title = "New Payment Recorded";
        message = `A payment of ${formattedAmount} has been recorded for ${patientName}'s ${type} appointment${doctorWithSuffix} on ${date}.`;
      } else if (isDoctor) {
        message = `A payment of ${formattedAmount} has been recorded for ${patientName}'s ${type} appointment on ${date}.`;
      }

      return createNotification(userId, title, message, "payment", {
        appointmentId,
        paymentId,
        patientName,
        appointmentDate: date,
        appointmentTime: appointmentData.time,
        doctor: docName,
        amount,
        paymentDate: new Date().toISOString(),
      });
    })
  );
};
