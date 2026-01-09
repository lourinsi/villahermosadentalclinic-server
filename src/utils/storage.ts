import fs from "fs";
import path from "path";

const DATA_DIR = "D:\\Villahermosa Dental Clinic 2.0\\villahermosa backend data";

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
console.log(`[STORAGE] Data persistence location: ${DATA_DIR}`);

export const readData = <T>(filename: string): T[] => {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading data from ${filename}.json:`, error);
    return [];
  }
};

export const writeData = <T>(filename: string, data: T[]): void => {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing data to ${filename}.json:`, error);
  }
};
