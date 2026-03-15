// @ts-ignore
import mongoose, { Document, Schema } from 'mongoose';

interface IQuestionnaire extends Document {
  patientId: string;
  
  // General Information
  gender?: string;
  civilStatus?: string;
  age?: number;
  ethnicity?: string;
  religion?: string;
  nationality?: string;
  
  // Current Address
  currentStreet?: string;
  currentBarangay?: string;
  currentCity?: string;
  currentProvince?: string;
  currentZipCode?: string;
  
  // Permanent Address
  permanentStreet?: string;
  permanentBarangay?: string;
  permanentCity?: string;
  permanentProvince?: string;
  permanentZipCode?: string;
  
  // Contact Information
  landline?: string;
  mobileContact?: string;
  emailAddress?: string;
  
  // Emergency Contact
  emergencyFirstName?: string;
  emergencyLastName?: string;
  emergencyRelationship?: string;
  
  // Other Information
  education?: string;
  occupation?: string;
  company?: string;
  companyAddress?: string;
  height?: string;
  weight?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

const questionnaireSchema = new Schema<IQuestionnaire>(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      ref: 'Patient',
    },
    // General Information
    gender: { type: String },
    civilStatus: { type: String },
    age: { type: Number },
    ethnicity: { type: String },
    religion: { type: String },
    nationality: { type: String },
    
    // Current Address
    currentStreet: { type: String },
    currentBarangay: { type: String },
    currentCity: { type: String },
    currentProvince: { type: String },
    currentZipCode: { type: String },
    
    // Permanent Address
    permanentStreet: { type: String },
    permanentBarangay: { type: String },
    permanentCity: { type: String },
    permanentProvince: { type: String },
    permanentZipCode: { type: String },
    
    // Contact Information
    landline: { type: String },
    mobileContact: { type: String },
    emailAddress: { type: String },
    
    // Emergency Contact
    emergencyFirstName: { type: String },
    emergencyLastName: { type: String },
    emergencyRelationship: { type: String },
    
    // Other Information
    education: { type: String },
    occupation: { type: String },
    company: { type: String },
    companyAddress: { type: String },
    height: { type: String },
    weight: { type: String },
  },
  { timestamps: true }
);

const Questionnaire = mongoose.model<IQuestionnaire>(
  'Questionnaire',
  questionnaireSchema,
  'questionnaires'
);

export default Questionnaire;