import { Notification } from "../types/notification";
import { NotificationType } from "../shared/notificationStatuses";
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
    n => n.userId === userId && n.metadata?.appointmentId === appointmentId && !n.isLog
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

/**
 * HYBRID NOTIFICATION STRATEGY
 * Creates a NEW notification for significant status/payment changes
 * Use this when a status or paymentStatus actually changes
 */
export const createStatusChangeNotification = (
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
  }
) => {
  const { oldStatus, newStatus, oldPaymentStatus, newPaymentStatus } = changeDetails;
  const { patientName, date, time, type, doctor } = appointmentData;

  console.log(`[createStatusChangeNotification] START userId=${userId} appointmentId=${appointmentId} oldStatus=${oldStatus} newStatus=${newStatus} oldPaymentStatus=${oldPaymentStatus} newPaymentStatus=${newPaymentStatus}`);

  // Determine title and message based on what changed
  let title = "Appointment Updated";
  let message = "";
  let notificationType: NotificationType = "appointment";

  if (newStatus && oldStatus !== newStatus) {
    title = "Appointment Status Changed";
    message = `Your appointment with Dr. ${doctor} for ${type} on ${date} is now ${newStatus}.`;
    notificationType = "appointment";
    console.log(`[createStatusChangeNotification] Status change detected: ${oldStatus} -> ${newStatus}`);
  } else if (newStatus && oldStatus === newStatus) {
    title = "Appointment Status Update";
    message = `Your appointment for ${type} on ${date} with Dr. ${doctor} is still ${newStatus}.`;
    notificationType = "appointment";
    console.log(`[createStatusChangeNotification] Status refresh: ${newStatus}`);
  } else if (newPaymentStatus && oldPaymentStatus !== newPaymentStatus) {
    title = "Payment Status Updated";
    message = `Payment status for your ${type} appointment updated to: ${newPaymentStatus}`;
    notificationType = "payment";
    console.log(`[createStatusChangeNotification] Payment status change detected: ${oldPaymentStatus} -> ${newPaymentStatus}`);
  } else if (newPaymentStatus && oldPaymentStatus === newPaymentStatus) {
    title = "Payment Status Updated";
    message = `Payment status for your ${type} appointment is: ${newPaymentStatus}`;
    notificationType = "payment";
    console.log(`[createStatusChangeNotification] Payment status refresh: ${newPaymentStatus}`);
  }

  // Create NEW notification (don't update existing)
  createNotification(
    userId,
    title,
    message,
    notificationType,
    {
      appointmentId,
      currentStatus: newStatus || oldStatus,
      patientName,
      appointmentDate: date,
      appointmentTime: time,
      changedFields: {
        ...(oldStatus && newStatus && { status: { from: oldStatus, to: newStatus } }),
        ...(oldPaymentStatus && newPaymentStatus && { paymentStatus: { from: oldPaymentStatus, to: newPaymentStatus } }),
        changedAt: new Date().toISOString()
      }
    }
  );
  
  console.log(`[createStatusChangeNotification] Notification created for userId=${userId}`);
};

/**
 * HYBRID NOTIFICATION STRATEGY
 * Updates metadata of an existing notification or creates if none exists
 * Use this for initial request and minor metadata updates (no status/payment change)
 */
export const updateNotificationMetadata = (
  userId: string,
  appointmentId: string,
  updates: {
    title?: string;
    message?: string;
    metadata?: Partial<Notification["metadata"]>;
  }
) => {
  const notifications = readData<Notification>(COLLECTION);

  const existingIndex = notifications.findIndex(
    n => n.userId === userId && n.metadata?.appointmentId === appointmentId && !n.isLog
  );

  if (existingIndex !== -1) {
    // Update metadata in existing notification
    notifications[existingIndex] = {
      ...notifications[existingIndex],
      ...(updates.title && { title: updates.title }),
      ...(updates.message && { message: updates.message }),
      metadata: {
        ...notifications[existingIndex].metadata,
        ...updates.metadata
      },
      updatedAt: new Date().toISOString()
    };
    writeData(COLLECTION, notifications);
    console.log(`[notifications] Updated metadata for notification id=${notifications[existingIndex].id}`);
  } else {
    console.warn(`[notifications] No existing notification found for user=${userId} appointment=${appointmentId}`);
  }
};

/**
 * LOGGING SYSTEM: Archives the old notification as a log entry (read-only)
 * Then creates a new active notification for the same appointment
 * This creates an activity log timeline visible to users
 */
export const archiveNotificationAsLog = (
  userId: string,
  appointmentId: string
) => {
  const notifications = readData<Notification>(COLLECTION);
  
  // Find all active notifications for this appointment
  const activeNotifications = notifications.filter(
    n => n.userId === userId && n.metadata?.appointmentId === appointmentId && !n.isLog
  );
  
  console.log(`[archiveNotificationAsLog] userId=${userId} appointmentId=${appointmentId} found ${activeNotifications.length} active notifications to archive`);
  
  if (activeNotifications.length > 0) {
    // Mark all as log entries (read-only)
    notifications.forEach((n, index) => {
      if (n.userId === userId && n.metadata?.appointmentId === appointmentId && !n.isLog) {
        notifications[index].isLog = true;
        notifications[index].isRead = true; // Auto-read logs
        notifications[index].updatedAt = new Date().toISOString();
      }
    });
    
    writeData(COLLECTION, notifications);
    console.log(`[archiveNotificationAsLog] Archived ${activeNotifications.length} notifications`);
  } else {
    console.log(`[archiveNotificationAsLog] No existing notification found to archive`);
  }
};

/**
 * HYBRID NOTIFICATION STRATEGY
 * Archives the old notification as a log entry, then creates NEW notifications for status/payment changes
 * Notifies multiple recipients of a significant change
 */
export const notifyStatusChange = (
  appointmentId: string,
  changeType: 'status' | 'payment',
  oldValue: string,
  newValue: string,
  recipientUserIds: string[],
  appointmentData: {
    patientName: string;
    date: string;
    time: string;
    type: string;
    doctor?: string;
  }
) => {
  console.log("[notifyStatusChange] Called with:", {
    appointmentId,
    changeType,
    oldValue,
    newValue,
    recipientUserIds,
    patientName: appointmentData.patientName
  });
  
  recipientUserIds.forEach(userId => {
    console.log(`[notifyStatusChange] Processing userId: ${userId}`);
    
    // First, archive the old notification as a log entry
    archiveNotificationAsLog(userId, appointmentId);
    
    // Then create the new notification
    if (changeType === 'status') {
      createStatusChangeNotification(
        userId,
        appointmentId,
        { oldStatus: oldValue, newStatus: newValue },
        appointmentData
      );
    } else if (changeType === 'payment') {
      createStatusChangeNotification(
        userId,
        appointmentId,
        { oldPaymentStatus: oldValue, newPaymentStatus: newValue },
        appointmentData
      );
    }
  });
  
  // Log all notifications for this appointment after update
  const allNotifications = readData<Notification>(COLLECTION);
  const appointmentNotifs = allNotifications.filter(n => n.metadata?.appointmentId === appointmentId);
  console.log(`[notifyStatusChange] FINAL STATE - Total notifications for appointmentId=${appointmentId}: ${appointmentNotifs.length}`);
  appointmentNotifs.forEach(n => {
    console.log(`  → Notification: id=${n.id} userId=${n.userId} isLog=${n.isLog} isRead=${n.isRead} status="${n.metadata?.currentStatus}" title="${n.title}"`);
  });
};

