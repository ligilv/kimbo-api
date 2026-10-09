import { Injectable } from '@nestjs/common';
import { ReportExtractor } from './report-extractor.js';
import type { ReportResult } from './report.schema.js';

type Value = ReportResult['values'][number];

const normal = (
  key: string,
  label: string,
  value: number,
  unit: string,
  low: number | null,
  high: number | null,
): Value => ({
  key,
  label,
  value,
  unit,
  low,
  high,
  status: 'normal',
  note: null,
  why: [],
  foods: { veg: [], nonveg: [] },
});

// A realistic report for AI_PROVIDER=mock: 24 values, 3 flagged.
export const MOCK_REPORT: ReportResult = {
  notAReport: false,
  takenOn: '2026-10-01',
  values: [
    {
      key: 'vitamin_d',
      label: 'Vitamin D',
      value: 14,
      unit: 'ng/mL',
      low: 30,
      high: 100,
      status: 'low',
      note: 'Your vitamin D is lower than it should be, which is very common in India.',
      why: [
        'Bone strength: helps you absorb calcium',
        'Immunity: helps fight infections',
        'Energy: low levels can make you tired',
      ],
      foods: {
        veg: ['Fortified milk', 'Mushrooms', 'Paneer', 'Curd'],
        nonveg: ['Eggs (with yolk)', 'Rohu or salmon', 'Sardines', 'Mackerel'],
      },
    },
    {
      key: 'vitamin_b12',
      label: 'Vitamin B12',
      value: 168,
      unit: 'pg/mL',
      low: 211,
      high: 911,
      status: 'low',
      note: 'Your vitamin B12 is a little low; it often is for people who eat mostly vegetarian food.',
      why: [
        'Energy: helps make red blood cells',
        'Nerves: keeps them working well',
        'Focus: low levels can affect memory',
      ],
      foods: {
        veg: ['Curd', 'Milk', 'Paneer', 'Fortified cereals'],
        nonveg: ['Eggs', 'Chicken', 'Fish', 'Mutton'],
      },
    },
    {
      key: 'ldl',
      label: 'LDL cholesterol',
      value: 142,
      unit: 'mg/dL',
      low: null,
      high: 100,
      status: 'high',
      note: 'Your LDL, the "bad" cholesterol, is higher than the healthy range.',
      why: [
        'Heart health: high LDL can clog arteries',
        'Blood flow: keeps vessels clear',
      ],
      foods: {
        veg: ['Oats', 'Rajma', 'Almonds', 'Flaxseeds'],
        nonveg: ['Grilled fish', 'Egg whites', 'Skinless chicken'],
      },
    },
    normal('hemoglobin', 'Hemoglobin', 14.2, 'g/dL', 13, 17),
    normal('rbc', 'Red blood cells', 4.9, 'million/µL', 4.5, 5.5),
    normal('wbc', 'White blood cells', 7200, '/µL', 4000, 11000),
    normal('platelets', 'Platelets', 2.6, 'lakh/µL', 1.5, 4.1),
    normal('hematocrit', 'Hematocrit', 43, '%', 40, 50),
    normal('mcv', 'MCV', 88, 'fL', 83, 101),
    normal('fasting_glucose', 'Fasting sugar', 92, 'mg/dL', 70, 100),
    normal('hba1c', 'HbA1c', 5.4, '%', null, 5.7),
    normal('total_cholesterol', 'Total cholesterol', 196, 'mg/dL', null, 200),
    normal('hdl', 'HDL cholesterol', 46, 'mg/dL', 40, 60),
    normal('triglycerides', 'Triglycerides', 128, 'mg/dL', null, 150),
    normal('tsh', 'TSH', 2.1, 'µIU/mL', 0.4, 4.2),
    normal('t3', 'T3', 1.2, 'ng/mL', 0.8, 2),
    normal('t4', 'T4', 8.1, 'µg/dL', 5.1, 14.1),
    normal('creatinine', 'Creatinine', 0.9, 'mg/dL', 0.7, 1.3),
    normal('urea', 'Urea', 24, 'mg/dL', 17, 43),
    normal('uric_acid', 'Uric acid', 5.6, 'mg/dL', 3.5, 7.2),
    normal('sgpt', 'SGPT (ALT)', 28, 'U/L', null, 50),
    normal('sgot', 'SGOT (AST)', 24, 'U/L', null, 50),
    normal('calcium', 'Calcium', 9.4, 'mg/dL', 8.6, 10.3),
    normal('iron', 'Iron', 88, 'µg/dL', 65, 175),
  ],
};

@Injectable()
export class MockReportExtractor implements ReportExtractor {
  extract(): Promise<string> {
    return Promise.resolve(JSON.stringify(MOCK_REPORT));
  }
}
