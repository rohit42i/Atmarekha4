import { track } from './analytics.js';

const KEY = 'atma-rekha-experiments';
function loadAssignments(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function saveAssignments(value){try{localStorage.setItem(KEY,JSON.stringify(value))}catch{}}
export function getExperimentVariant(name,variants=['A','B']){const assignments=loadAssignments();if(!assignments[name]){const index=Math.floor(Math.random()*variants.length);assignments[name]=variants[index]||variants[0];saveAssignments(assignments)}const variant=assignments[name];track('experiment_exposure',{experiment:name,variant});return variant}
