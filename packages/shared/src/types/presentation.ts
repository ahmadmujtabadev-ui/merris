import { z } from 'zod';
import {
  PresentationSchema,
  DeckTypeSchema,
  SlideSpecSchema,
  SlideLayoutSchema,
  SlideContentSchema,
  ChartTypeSchema,
} from '../validators/schemas.js';

export type Presentation = z.infer<typeof PresentationSchema>;
export type DeckType = z.infer<typeof DeckTypeSchema>;
export type SlideSpec = z.infer<typeof SlideSpecSchema>;
export type SlideLayout = z.infer<typeof SlideLayoutSchema>;
export type SlideContent = z.infer<typeof SlideContentSchema>;
export type ChartType = z.infer<typeof ChartTypeSchema>;
