// feature.js — новото първо в Лабораторията (http://localhost:3610): там feature(id) е винаги true,
// а в играта (:3600 и сайта) — само след „✓ OK“ в раздела „Ново“ (сървърът записва lab/approved.js).
// Употреба в кода: import { feature } from './lab/feature.js'; if (feature('нещо-ново')) { … }
import { APPROVED } from './approved.js';
export const IN_LAB = location.port === '3610';
// ?off=a,b — изключва тези флагове за едно зареждане (търсене на виновника в Лабораторията, T2)
const OFF = new Set((typeof location !== 'undefined' && new URLSearchParams(location.search).get('off') || '').split(',').filter(Boolean));
export const feature = id => !OFF.has(id) && (IN_LAB || APPROVED.includes(id));
