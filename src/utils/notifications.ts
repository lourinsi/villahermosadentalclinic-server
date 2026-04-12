import { Notification } from "../types/notification";
import { NotificationType } from "../shared/notificationStatuses";
import { readData, writeData } from "./storage";
import { getAppointmentTypeName } from "./appointment-types";

const COLLECTION = "notifications";

console.log("[notifications] SYSTEM LOADED - Version: 2.1.0 (Detailed Admin Alerts & Isolation)");

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
    isLog: false,
  };

  console.log(`[notifications] CREATING: id=${newNotification.id} userId=${userId} type=${type} title="${title}"`);
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

  // Search by userId, appointmentId AND type to keep different notification streams separate
  const existingNotificationIndex = notifications.findIndex(
    n => n.userId === userId && 
         n.metadata?.appointmentId === appointmentId && 
         n.type === details.type && 
         !n.isLog
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
      isLog: false,
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
 * Helper to format doctor name consistently (removes "Dr. " prefix if already present)
 */
const formatDoctorName = (name?: string): string => {
  if (!name) return "";
  const cleanName = name.replace(/^Dr\.\s+/i, "");
  return `Dr. ${cleanName}`;
};

/**
 * Resolves the recipient IDs for an appointment (Patient, Doctor, Admin)
 */
export const resolveRecipients = (appointment: any): string[] => {
  const recipients = new Set<string>();
  
  // 1. Patient
  if (appointment.patientId) {
    recipients.add(appointment.patientId);
  }
  
  // 2. Doctor
  if (appointment.doctor) {
    const staff = readData<any>("staff");
    // Case-insensitive search to be more robust
    const searchName = appointment.doctor.toLowerCase().trim();
    const doctor = staff.find((s: any) => 
      s.name.toLowerCase().trim() === searchName || 
      s.name.toLowerCase().trim().replace(/^dr\.\s+/i, "") === searchName.replace(/^dr\.\s+/i, "")
    );
    
    if (doctor && doctor.id) {
      console.log(`[notifications] resolveRecipients: Found doctor match: ${doctor.name} (id: ${doctor.id})`);
      recipients.add(doctor.id);
    } else {
      console.warn(`[notifications] resolveRecipients: No doctor match found for "${appointment.doctor}"`);
    }
  }
  
  // 3. Admin
  recipients.add("admin");
  
  const result = Array.from(recipients).filter(Boolean);
  console.log(`[notifications] resolveRecipients: final list: ${result.join(',')}`);
  return result;
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
    let adminMessage = "";
    let statusText = appointment.status;
    if (statusText === "scheduled" || statusText === "confirmed") statusText = "scheduled";
    
    const isAdminRecipient = adminId === 'admin';
    const isDoctorRecipient = adminId.startsWith('staff_');

    if (isAdminRecipient) {
      const doctorText = appointment.doctor ? ` with Dr. ${appointment.doctor}` : "";
      adminMessage = `The appointment for ${appointment.patientName}${doctorText} (${serviceName}) on ${appointment.date} is now ${statusText}.`;

      if (actionType === 'created') {
        adminTitle = isRequest ? "New Appointment Request" : "New Appointment Scheduled";
        adminMessage = `${appointment.patientName} has a ${appointment.status} appointment${doctorText} for ${serviceName} on ${appointment.date} at ${appointment.time}.`;
      } else if (actionType === 'public_request') {
        adminTitle = "New Public Booking Request";
        adminMessage = `${appointment.patientName} has requested a ${serviceName} appointment${doctorText} for ${appointment.date} at ${appointment.time} via public portal.`;
      } else if (actionType === 'updated') {
        adminTitle = "Appointment Status Updated";
        if (appointment.doctor) {
          if (appointment.status === "confirmed" || appointment.status === "scheduled") {
            adminMessage = `Dr. ${appointment.doctor} has accepted the appointment for ${appointment.patientName} (${serviceName}) on ${appointment.date}.`;
          } else if (appointment.status === "cancelled") {
            adminMessage = `Dr. ${appointment.doctor} has cancelled the appointment for ${appointment.patientName} (${serviceName}) on ${appointment.date}.`;
          } else if (appointment.status === "completed") {
            adminMessage = `Dr. ${appointment.doctor} has marked the appointment for ${appointment.patientName} (${serviceName}) as completed.`;
          } else if (appointment.status === "tentative") {
            adminMessage = `${appointment.patientName} has made a partial payment for the ${serviceName} appointment with Dr. ${appointment.doctor} on ${appointment.date}.`;
          }
        }
      }
    } else if (isDoctorRecipient) {
      // Doctor view - more concise, no self-reference
      adminMessage = `Appointment for ${appointment.patientName} (${serviceName}) on ${appointment.date} is now ${statusText}.`;

      if (actionType === 'created' || actionType === 'public_request') {
        adminTitle = isRequest ? "New Appointment Request" : "New Appointment Scheduled";
        adminMessage = `${appointment.patientName} has a ${appointment.status} appointment for ${serviceName} on ${appointment.date} at ${appointment.time}.`;
      } else if (actionType === 'updated') {
        adminTitle = "Appointment Status Updated";
        if (appointment.status === "confirmed" || appointment.status === "scheduled") {
          adminMessage = `Appointment for ${appointment.patientName} (${serviceName}) on ${appointment.date} has been scheduled.`;
        } else if (appointment.status === "cancelled") {
          adminMessage = `Appointment for ${appointment.patientName} (${serviceName}) on ${appointment.date} has been cancelled.`;
        } else if (appointment.status === "completed") {
          adminMessage = `Appointment for ${appointment.patientName} (${serviceName}) on ${appointment.date} has been marked as completed.`;
        } else if (appointment.status === "tentative") {
          adminMessage = `${appointment.patientName} has made a partial payment for the ${serviceName} appointment.`;
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
    cancellationReason?: string; // Reason if appointment was cancelled
  },
  amount?: number // Optional amount to include in payment message
) => {
  const { oldStatus, newStatus, oldPaymentStatus, newPaymentStatus } = changeDetails;
  const { patientName, date, time, type, doctor, cancellationReason } = appointmentData;
  const docName = formatDoctorName(doctor);
  const doctorWithSuffix = docName ? ` with ${docName}` : "";

  console.log(`[createStatusChangeNotification] START userId=${userId} appointmentId=${appointmentId} oldStatus=${oldStatus} newStatus=${newStatus} oldPaymentStatus=${oldPaymentStatus} newPaymentStatus=${newPaymentStatus} amount=${amount || 'none'} cancellationReason=${cancellationReason || 'none'}`);

  // Determine title and message based on what changed
  let title = "Appointment Updated";
  let message = "";
  let notificationType: NotificationType = "appointment";

  // Descriptive messages based on role (Admin, Doctor, Patient)
  const isAdmin = userId === 'admin';
  const isDoctor = userId.startsWith('staff_');
  
  let subjectText = `Your appointment${doctorWithSuffix}`;
  if (isAdmin) {
    subjectText = `${patientName}'s appointment${doctorWithSuffix}`;
  } else if (isDoctor) {
    subjectText = `${patientName}'s appointment`;
  }

  if (newStatus && oldStatus !== newStatus) {
    title = "Appointment Status Changed";
    
    // Include cancellation reason if appointment was cancelled
    if (newStatus === "cancelled" && cancellationReason) {
      message = `${subjectText} for ${type} on ${date} has been cancelled. Reason: ${cancellationReason}`;
    } else {
      message = `${subjectText} for ${type} on ${date} is now ${newStatus}.`;
    }
    notificationType = "appointment";
    console.log(`[createStatusChangeNotification] Status change detected: ${oldStatus} -> ${newStatus}`);
  } else if (newStatus && oldStatus === newStatus) {
    title = "Appointment Status Update";
    message = `${subjectText} for ${type} on ${date} is still ${newStatus}.`;
    notificationType = "appointment";
    console.log(`[createStatusChangeNotification] Status refresh: ${newStatus}`);
  } else if (newPaymentStatus && oldPaymentStatus !== newPaymentStatus) {
    title = "Payment Status Updated";
    let statusLabel = newPaymentStatus.toLowerCase();
    if (newPaymentStatus === 'paid') statusLabel = 'fully paid';
    else if (newPaymentStatus === 'half-paid') statusLabel = 'partially paid';
    else if (newPaymentStatus === 'pay-at-clinic') statusLabel = 'set to pay at clinic';
    
    const currencySymbol = "₱";
    const amountText = amount ? ` of ${currencySymbol}${amount.toLocaleString()}` : "";
    
    let paymentSubjectText = `The payment status for your ${type} appointment${doctorWithSuffix}`;
    if (isAdmin) {
      paymentSubjectText = `The payment status for ${patientName}'s ${type} appointment${doctorWithSuffix}`;
    } else if (isDoctor) {
      paymentSubjectText = `The payment status for ${patientName}'s ${type} appointment`;
    }

    message = `${paymentSubjectText}${amountText} on ${date} is now ${statusLabel}.`;
    notificationType = "payment";
    console.log(`[createStatusChangeNotification] Payment status change detected: ${oldPaymentStatus} -> ${newPaymentStatus}`);
  } else if (newPaymentStatus && oldPaymentStatus === newPaymentStatus) {
    title = "Payment Status Updated";
    let paymentSubjectText = `Payment status for your ${type} appointment${doctorWithSuffix}`;
    if (isAdmin) {
      paymentSubjectText = `Payment status for ${patientName}'s ${type} appointment${doctorWithSuffix}`;
    } else if (isDoctor) {
      paymentSubjectText = `Payment status for ${patientName}'s ${type} appointment`;
    }
    message = `${paymentSubjectText} is: ${newPaymentStatus}`;
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
      doctor: docName,
      amount: amount,
      cancellationReason: cancellationReason,
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
  appointmentId: string,
  type?: NotificationType // Optional type to only archive specific category
) => {
  const notifications = readData<Notification>(COLLECTION);
  
  // Find all active notifications for this appointment (optionally filtered by type)
  const activeNotifications = notifications.filter(
    n => n.userId === userId && 
         n.metadata?.appointmentId === appointmentId && 
         !n.isLog &&
         (!type || n.type === type)
  );
  
  console.log(`[archiveNotificationAsLog] userId=${userId} appointmentId=${appointmentId} type=${type || 'any'} found ${activeNotifications.length} active notifications to archive`);
  
  if (activeNotifications.length > 0) {
    // Mark all as log entries (read-only)
    notifications.forEach((n, index) => {
      if (n.userId === userId && 
          n.metadata?.appointmentId === appointmentId && 
          !n.isLog &&
          (!type || n.type === type)) {
        console.log(`[notifications] ARCHIVING: id=${n.id} userId=${n.userId} prevTitle="${n.title}" type=${n.type}`);
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
    cancellationReason?: string; // Reason if appointment was cancelled
  },
  amount?: number // Optional amount to combine payment receipt with status change
) => {
  console.log(`[notifications] notifyStatusChange start: id=${appointmentId} type=${changeType} from=${oldValue} to=${newValue} amount=${amount || 'none'}`);
  
  recipientUserIds.forEach(userId => {
    console.log(`[notifications] notifyStatusChange processing user=${userId}`);
    
    // First, archive the old notification as a log entry (type-aware)
    // Only archive if it's a status change (appointment), not for payments as requested
    if (changeType === 'status') {
      archiveNotificationAsLog(userId, appointmentId, 'appointment');
    }
    
    // Then create the new notification
    if (changeType === 'status') {
      console.log(`[notifications] notifyStatusChange: calling createStatusChangeNotification (status) for user=${userId}`);
      createStatusChangeNotification(
        userId,
        appointmentId,
        { oldStatus: oldValue, newStatus: newValue },
        appointmentData
      );
    } else if (changeType === 'payment') {
      console.log(`[notifications] notifyStatusChange: calling createStatusChangeNotification (payment) for user=${userId}`);
      createStatusChangeNotification(
        userId,
        appointmentId,
        { oldPaymentStatus: oldValue, newPaymentStatus: newValue },
        appointmentData,
        amount
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

/**
 * Notifies multiple recipients that a payment has been received for an appointment.
 */
export const notifyPaymentReceived = (
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
  console.log(`[notifications] notifyPaymentReceived start: id=${appointmentId} amount=${amount} paymentId=${paymentId || 'none'}`);
  const { patientName, date, type, doctor } = appointmentData;
  const currencySymbol = "₱";
  const formattedAmount = `${currencySymbol}${amount.toLocaleString()}`;

  recipients.forEach(userId => {
    console.log(`[notifications] notifyPaymentReceived processing user=${userId}`);
    // SKIP archiving for payments as requested - they should not be logs
    // archiveNotificationAsLog(userId, appointmentId, 'payment');

    // Determine title and message based on the recipient
    let title = "Payment Received";
    const docName = formatDoctorName(doctor);
    const doctorWithSuffix = docName ? ` with ${docName}` : "";
    let message = `We've received a payment of ${formattedAmount} for your ${type} appointment${doctorWithSuffix} on ${date}.`;

    // For admin or staff (including doctors), use a more descriptive message
    const isAdmin = userId === 'admin';
    const isDoctor = userId.startsWith('staff_');
    
    if (isAdmin) {
      title = "New Payment Recorded";
      message = `A payment of ${formattedAmount} has been recorded for ${patientName}'s ${type} appointment${doctorWithSuffix} on ${date}.`;
    } else if (isDoctor) {
      title = "Payment Received";
      message = `A payment of ${formattedAmount} has been recorded for ${patientName}'s ${type} appointment on ${date}.`;
    }

    console.log(`[notifications] notifyPaymentReceived: calling createNotification for user=${userId}`);
    createNotification(
      userId,
      title,
      message,
      "payment",
      {
        appointmentId,
        paymentId, // Include unique payment ID to prevent overwriting
        patientName,
        appointmentDate: date,
        appointmentTime: appointmentData.time,
        doctor: docName,
        amount: amount,
        paymentDate: new Date().toISOString()
      }
    );
  });
  console.log(`[notifications] notifyPaymentReceived finished`);
};

