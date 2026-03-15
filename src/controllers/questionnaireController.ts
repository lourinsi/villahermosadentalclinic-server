import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const DATA_DIR = 'D:\\Villahermosa Dental Clinic 2.0\\villahermosa backend data';
const QUESTIONNAIRES_DIR = path.join(DATA_DIR, 'questionnaires');

// Ensure directory exists
if (!fs.existsSync(QUESTIONNAIRES_DIR)) {
  fs.mkdirSync(QUESTIONNAIRES_DIR, { recursive: true });
}

// Get questionnaire file path
const getQuestionnaireFilePath = (patientId: string): string => {
  return path.join(QUESTIONNAIRES_DIR, `${patientId}.json`);
};

// Get questionnaire by patient ID
export const getQuestionnaire = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    console.log('[QUESTIONNAIRE] Getting questionnaire for patientId:', patientId);

    const filePath = getQuestionnaireFilePath(patientId);

    if (!fs.existsSync(filePath)) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No questionnaire found',
      });
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    const questionnaire = JSON.parse(data);

    res.status(200).json({
      success: true,
      data: questionnaire,
    });
  } catch (error) {
    console.error('Error fetching questionnaire:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questionnaire',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Create or update questionnaire
export const upsertQuestionnaire = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const questionnaireData = req.body;
    
    console.log('[QUESTIONNAIRE] Upserting questionnaire for patientId:', patientId);
    console.log('[QUESTIONNAIRE] Data:', questionnaireData);

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required',
      });
    }

    const filePath = getQuestionnaireFilePath(patientId);
    
    // Create questionnaire object with timestamp
    const questionnaire = {
      patientId,
      ...questionnaireData,
      updatedAt: new Date().toISOString(),
    };

    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(questionnaire, null, 2), 'utf-8');

    console.log('[QUESTIONNAIRE] Saved questionnaire to:', filePath);

    res.status(200).json({
      success: true,
      data: questionnaire,
      message: 'Questionnaire saved successfully',
    });
  } catch (error) {
    console.error('Error saving questionnaire:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save questionnaire',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Delete questionnaire
export const deleteQuestionnaire = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    console.log('[QUESTIONNAIRE] Deleting questionnaire for patientId:', patientId);

    const filePath = getQuestionnaireFilePath(patientId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Questionnaire not found',
      });
    }

    fs.unlinkSync(filePath);

    res.status(200).json({
      success: true,
      message: 'Questionnaire deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting questionnaire:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete questionnaire',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};