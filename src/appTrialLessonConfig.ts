import { versionRangeExists } from './abTestConfig'
import type { Target } from './abTestConfig'

export const TRIAL_LESSON_SLOT='app.trial_lesson.version'
export type TrialLessonVersion={id:string;version:string;name:string;summary:string;minAppVersion:string;status:'PUBLISHED'|'RETIRED'|'DRAFT'}
// Explicit prototype fixtures. Replace with the published course catalogue when connected.
export const trialLessonVersions:readonly TrialLessonVersion[]=[
 {id:'demo-trial-v1',version:'V1.0',name:'体验课标准版',summary:'用于演示现有基础体验课版本。',minAppVersion:'1.8.0',status:'PUBLISHED'},
 {id:'demo-trial-v2',version:'V2.0',name:'体验课新版',summary:'用于演示不同实验组选择不同体验课版本。',minAppVersion:'1.9.0',status:'PUBLISHED'},
 {id:'demo-trial-retired',version:'V0.9',name:'历史体验课',summary:'已停用，仅用于历史记录及可用性校验。',minAppVersion:'1.8.0',status:'RETIRED'},
]
export const defaultTrialLessonVersionId='demo-trial-v1'
export const trialLessonVersion=(id:unknown)=>trialLessonVersions.find(v=>v.id===id)
export function trialLessonLabel(id:unknown){const v=trialLessonVersion(id);return v?`${v.version} · ${v.name}`:id?`${String(id)}（不可用）`:'未记录版本'}
export function trialLessonErrors(id:unknown,target?:Target):string[]{
 const v=trialLessonVersion(id)
 if(!v||v.status!=='PUBLISHED')return ['请选择已发布且可用的体验课版本。']
 if(target&&versionRangeExists([...target.versions,{operator:'<',value:v.minAppVersion}]))return [`体验课 ${v.version} 要求 App ≥ ${v.minAppVersion}，当前适用范围包含不兼容版本。请在第一步调整 App 版本条件，或选择兼容的体验课版本。`]
 return []
}
// A course already in progress keeps its original version across config changes.
export const resolveTrialLessonVersion=(configuredId:string,inProgressVersionId?:string)=>inProgressVersionId||configuredId
