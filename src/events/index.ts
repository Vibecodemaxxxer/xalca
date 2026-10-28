import type { EventDef } from './types';
import { testEvent } from './test-event';

/**
 * Реестр сезонных ивентов. Каждый ивент — отдельный файл в этой папке (например, ramazan.tsx),
 * здесь его достаточно добавить в список.
 */
export const EVENTS: EventDef[] = [];

// Тестовый ивент — только в сборке для проверки (VITE_TEST_EVENT=<дата начала>), в обычную не попадает.
if (import.meta.env.VITE_TEST_EVENT) EVENTS.push(testEvent(import.meta.env.VITE_TEST_EVENT));
