import { Notification, NotificationType } from "../types/notification";
import { readData, writeData } from "./storage";
import { getAppointmentTypeName } from "./appointment-types";

const COLLECTION = "notifications";

/**
 * Creates a new notification for a specific user
 */
export const createNotification = (
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  metadata?: Notification["metadata"]
): Notification => {
  const notifications = readData<Notification>(COLLECTION);
  
  const newNotification: Notification = {
    id: `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId,
    title,
    message,
    type,
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isRead: false,
    deleted: false,
  };

  notifications.push(newNotification);
  writeData(COLLECTION, notifications);
  
  return newNotification;
};

/**
 * Updates an existing notification for a specific appointment, or creates a new one if none exists.
 * This ensures that a user only sees ONE notification per appointment, which updates as the status changes.
 */
export const updateOrCreateNotificationForAppointment = (
  userId: string,
  appointmentId: string,
  details: {
    title: string;
    message: string;
    type: NotificationType;
    metadata: Notification["metadata"];
  }
) => {
  const notifications = readData<Notification>(COLLECTION);

  const existingNotificationIndex = notifications.findIndex(
    n => n.userId === userId && n.metadata?.appointmentId === appointmentId
  );

  if (existingNotificationIndex !== -1) {
    // Update existing notification to "look new" but keep the same entry
    console.log(`[notifications] Updating notification for user=${userId} appointment=${appointmentId} - metadata=`, details.metadata);
    notifications[existingNotificationIndex] = {
      ...notifications[existingNotificationIndex],
      title: details.title,
      message: details.message,
      type: details.type,
      metadata: details.metadata,
      isRead: false, // Make it unread again so it appears new
      updatedAt: new Date().toISOString(), // Update date to latest
      deleted: false, // Ensure it's not hidden if it was previously deleted
    };
    writeData(COLLECTION, notifications);
    console.log(`[notifications] Updated notification id=${notifications[existingNotificationIndex].id} updatedAt=${notifications[existingNotificationIndex].updatedAt}`);
  } else {
    // Create new notification if none exists for this user/appointment
    const newNotification: Notification = {
      id: `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId,
      title: details.title,
      message: details.message,
      type: details.type,
      metadata: details.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isRead: false,
      deleted: false,
    };
    notifications.push(newNotification);
    writeData(COLLECTION, notifications);
    console.log(`[notifications] Created notification id=${newNotification.id} for user=${userId} appointment=${appointmentId}`);
  }
};

/**
 * Notifies all admin/manager staff members
 */
export const notifyAdmin = (
  title: string,
  message: string,
  type: NotificationType,
  metadata?: Notification["metadata"]
) => {
  // Only notify the literal "admin" user for cross-doctor/admin-level notifications.
  // Previously we included staff members with roles like "lead dentist" or "manager",
  // which caused doctors to receive admin/third-person notifications. The requirement
  // is that only the admin user receives these multi-doctor notifications.
  const adminUserId = "admin";

  if (metadata?.appointmentId) {
    updateOrCreateNotificationForAppointment(adminUserId, metadata.appointmentId, {
      title,
      message,
      type,
      metadata,
    });
  } else {
    createNotification(adminUserId, title, message, type, metadata);
  }
};

/**
 * Notifies all relevant parties about an appointment change.
 * This centralizes the logic for "who gets what message" and ensures multi-perspective views.
 * It also prevents duplicate notifications for the same user (e.g. if a doctor is also an admin).
 */
export const notifyAppointmentChange = (
  appointment: any,
  actionType: 'created' | 'updated' | 'public_request',
  context?: { oldStatus?: string; changedFields?: { [key: string]: any } }
) => {
  // 0. Skip notifications for "pending" status
  // The user requested that pending bookings should not be a notification.
  // These should only be visible in the "Requests" page.
  if (appointment.status === "pending") {
    return;
  }

  const serviceName = getAppointmentTypeName(appointment.type, appointment.customType);
  const isRequest = ["pending", "tentative", "To Pay"].includes(appointment.status);
  
  // Collect all unique user IDs to notify
  const recipients = new Map<string, { title: string; message: string; isDoctor?: boolean; isAdmin?: boolean; isPatient?: boolean }>();

  // 1. Identify Patient
  if (appointment.patientId) {
    let patientTitle = "Appointment Update";
    let statusText = appointment.status;
    if (statusText === "scheduled" || statusText === "confirmed") statusText = "scheduled";
    
    let patientMessage = `Your appointment for ${serviceName} on ${appointment.date} is now ${statusText}.`;

    if (actionType === 'created') {
      patientTitle = "Appointment Scheduled";
      patientMessage = `Your appointment for ${serviceName} is scheduled for ${appointment.date} at ${appointment.time}.`;
    } else if (actionType === 'public_request') {
      patientTitle = "Appointment Request Received";
      patientMessage = `Your request for a ${serviceName} appointment on ${appointment.date} at ${appointment.time} has been received and is pending confirmation.`;
    } else if (actionType === 'updated') {
      // If the appointment was rescheduled (date or time changed), give a clearer message to the patient
      const changed = context?.changedFields || {};
      const rescheduled = changed.date !== undefined || changed.time !== undefined;
      if (rescheduled) {
        patientTitle = "Appointment Updated";
        patientMessage = `Your appointment for ${serviceName} has been updated to ${appointment.date} at ${appointment.time}.`;
      }
    }

    recipients.set(appointment.patientId, { title: patientTitle, message: patientMessage, isPatient: true });
  }

  // 2. Identify Doctor
  let assignedDoctorId = "";
  if (appointment.doctor) {
    const staff = readData<any>("staff");
    const doctor = staff.find((s: any) => s.name === appointment.doctor);
    if (doctor && doctor.id) {
      assignedDoctorId = doctor.id;
      let doctorTitle = isRequest ? "New Appointment Request" : "Appointment Update";
      let statusText = appointment.status;
      if (statusText === "scheduled" || statusText === "confirmed") statusText = "scheduled";
      
      let doctorMessage = `Appointment with ${appointment.patientName} for ${serviceName} on ${appointment.date} is now ${statusText}.`;

      if (actionType === 'created' || actionType === 'public_request') {
        doctorTitle = isRequest ? "New Appointment Request" : "New Appointment Scheduled";
        doctorMessage = `${appointment.patientName} has a ${appointment.status} appointment for ${serviceName} on ${appointment.date} at ${appointment.time}.`;
      }

      recipients.set(assignedDoctorId, { title: doctorTitle, message: doctorMessage, isDoctor: true });
    }
  }

  // 3. Identify Admins
  // Only the literal "admin" user should receive cross-doctor/admin notifications.
  // Avoid notifying staff members (e.g. lead dentists) with third-person admin messages.
  const adminUserIds = new Set<string>(["admin"]);

  adminUserIds.forEach(adminId => {
    // If the admin is also the assigned doctor, we prefer the "Doctor" specific message
    // If not, we give them the "Admin" (third person) message
    if (recipients.has(adminId)) return;

    let adminTitle = isRequest ? "New Appointment Request" : "Appointment Update";
    let statusText = appointment.status;
    if (statusText === "scheduled" || statusText === "confirmed") statusText = "scheduled";
    
    let adminMessage = `The appointment for ${appointment.patientName} (${serviceName}) on ${appointment.date} is now ${statusText}.`;

    if (actionType === 'created') {
      adminTitle = isRequest ? "New Appointment Request" : "New Appointment Scheduled";
      adminMessage = `${appointment.patientName} has a ${appointment.status} appointment for ${serviceName} on ${appointment.date} at ${appointment.time}.`;
    } else if (actionType === 'public_request') {
      adminTitle = "New Public Booking Request";
      adminMessage = `${appointment.patientName} has requested a ${serviceName} appointment for ${appointment.date} at ${appointment.time} via public portal.`;
    } else if (actionType === 'updated') {
      adminTitle = "Appointment Status Updated";
      if (appointment.doctor) {
        if (appointment.status === "confirmed" || appointment.status === "scheduled") {
          adminMessage = `${appointment.doctor} has accepted the appointment for ${appointment.patientName} (${serviceName}) on ${appointment.date}.`;
        } else if (appointment.status === "cancelled") {
          adminMessage = `${appointment.doctor} has cancelled the appointment for ${appointment.patientName} (${serviceName}) on ${appointment.date}.`;
        } else if (appointment.status === "completed") {
          adminMessage = `${appointment.doctor} has marked the appointment for ${appointment.patientName} (${serviceName}) as completed.`;
        } else if (appointment.status === "tentative") {
           adminMessage = `${appointment.patientName} has made a partial payment for the ${serviceName} appointment on ${appointment.date}.`;
        }
      }
    }

    recipients.set(adminId, { title: adminTitle, message: adminMessage, isAdmin: true });
  });

  // Now send all notifications (Deduplicated by recipient)
  console.log(`[notifications] notifyAppointmentChange action=${actionType} appointment=${appointment.id} recipients=${Array.from(recipients.keys()).join(',')}`);
  recipients.forEach((data, userId) => {
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
        isRequest: isRequest,
        isDoctorView: data.isDoctor,
        isAdminView: data.isAdmin,
        isPatientView: data.isPatient,
        changedFields: context?.changedFields
      }
    });
  });
};
