export type Platform = 'iOS' | 'Android'
export type VersionOperator = '>' | '>=' | '=' | '<' | '<='
export type VersionCondition = { operator: VersionOperator; value: string }
export type Target = { countries: string[]; platforms: Platform[]; versions: VersionCondition[] }
export type PageCopy = { title: string; body: string; button: string; animation: 'static' | 'breathe' | 'shake' }
export type Plan = { template: string; copy: Record<string, PageCopy>; translations: Record<string, Record<string, PageCopy>> }
export type OnlineConfig = { id: string; name: string; target: Target; plan: Plan; status: 'draft' | 'published' | 'retired'; revision: number; replacesId?: string; source?: string; updatedAt: string }
export type Variant = { id: string; name: string; weight: number; control: boolean; plan: Plan }
export type Experiment = { id: string; name: string; target: Target; traffic: number; variants: Variant[]; startMode: 'now' | 'scheduled'; startAt: string; endAt: string; status: 'draft' | 'enabled' | 'closed'; closedAt?: string; base: { id: string; name: string; revision: number; plan: Plan }; updatedAt: string }
export type ABStore = { version: 2; online: OnlineConfig[]; experiments: Experiment[] }
export const STORAGE_KEY = 'dinoai_app_ab_config_v2'
export const countries = [
  { value: '*', label: '全部国家' }, { value: 'SA', label: '沙特阿拉伯（SA）' },
  { value: 'MY', label: '马来西亚（MY）' }, { value: 'US', label: '美国（US）' },
  { value: 'VN', label: '越南（VN）' }, { value: 'KR', label: '韩国（KR）' },
  { value: 'AE', label: '阿联酋（AE）' }, { value: 'TH', label: '泰国（TH）' },
  { value: 'ID', label: '印度尼西亚（ID）' }, { value: 'JP', label: '日本（JP）' },
  { value: 'SG', label: '新加坡（SG）' },
]
export const languages = [{ value: 'zh', label: '中文（基础文案）' }, { value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }, { value: 'ko', label: '한국어' }, { value: 'vi', label: 'Tiếng Việt' }, { value: 'ms', label: 'Bahasa Melayu' }]
export const templates = [
  { id: 'register-first', name: '先注册，再体验', badge: '方案 01', desc: '先建立账号，再完成资料与课程体验。', nodes: ['auth', 'name', 'age', 'level', 'goal', 'teacher', 'lesson', 'report', 'plan', 'paywall', 'home'] },
  { id: 'experience-first', name: '先体验，支付后注册', badge: '方案 02', desc: '游客先体验课程，购买页结束后衔接注册。', nodes: ['value', 'name', 'age', 'level', 'goal', 'teacher', 'lesson', 'report', 'plan', 'paywall', 'auth', 'home'] },
  { id: 'double-paywall', name: '课前和课后各一次购买页', badge: '方案 03', desc: '两处购买页独立配置，点击购买时先登录。', nodes: ['value', 'name', 'age', 'level', 'goal', 'plan', 'paywall-before', 'teacher', 'lesson', 'report', 'paywall-after', 'auth', 'home'] },
]
export const labels: Record<string, string> = { value: '首启价值页', auth: '注册登录', name: '孩子称呼', age: '孩子年龄', level: '英语水平', goal: '学习目标', teacher: '选老师', lesson: '体验课', report: '完课报告', plan: '学习计划', paywall: '主购买页', 'paywall-before': '课前购买页', 'paywall-after': '课后购买页', home: '首页' }
const defaults: Record<string, Omit<PageCopy, 'animation'>> = {
  value: { title: '让孩子自信开口说英语', body: '和 Dino 一起，在有趣的互动中开启英语学习之旅。', button: '我是新用户' },
  auth: { title: '开启孩子的英语成长之旅', body: '每一次开口，都是成长的一小步。', button: '继续注册 / 登录' },
  name: { title: '我们该怎么称呼你？', body: '告诉 Dino 你的名字，让我们成为朋友吧。', button: '继续' },
  age: { title: '孩子今年几岁？', body: '我们会推荐适合孩子年龄的学习内容。', button: '继续' },
  level: { title: '孩子的英语水平怎么样？', body: '选择最符合当前情况的一项。', button: '继续' },
  goal: { title: '你希望孩子收获什么？', body: '让每一次练习，都更接近学习目标。', button: '继续' },
  paywall: { title: '给孩子更多开口的机会', body: '开启专属英语学习旅程，让进步每天发生。', button: '开启学习之旅' },
}
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
export const makeId = () => globalThis.crypto.randomUUID()
export const isPaywall = (node: string) => node.startsWith('paywall')
export const isEditableNode = (node: string) => Boolean(defaults[isPaywall(node) ? 'paywall' : node])
export function newPlan(): Plan {
  return { template: templates[0].id, copy: Object.fromEntries(Object.keys(labels).filter(isEditableNode).map(node => [node, { ...defaults[isPaywall(node) ? 'paywall' : node], animation: 'static' }])), translations: {} }
}
export const defaultTarget = (): Target => ({ countries: ['SA'], platforms: ['Android'], versions: [{ operator: '>=', value: '1.8.0' }, { operator: '<', value: '1.9.0' }] })
export function newOnline(): OnlineConfig {
  return { id: makeId(), name: '', target: defaultTarget(), plan: newPlan(), status: 'draft', revision: 0, updatedAt: new Date().toISOString() }
}
export function newExperiment(base: OnlineConfig): Experiment {
  return { id: makeId(), name: '', target: clone(base.target), traffic: 20, variants: [
    { id: makeId(), name: 'A 组', weight: 50, control: true, plan: clone(base.plan) },
    { id: makeId(), name: 'B 组', weight: 50, control: false, plan: clone(base.plan) },
  ], startMode: 'now', startAt: '', endAt: new Date(Date.now() + 7 * 86400000).toISOString(), status: 'draft', base: { id: base.id, name: base.name, revision: base.revision, plan: clone(base.plan) }, updatedAt: new Date().toISOString() }
}
export function seedStore(): ABStore {
  const online = newOnline()
  return { version: 2, online: [{ ...online, id: 'online-example-sa-android', name: '沙特 Android 线上方案（示例）', status: 'published', revision: 1 }], experiments: [] }
}

type Version = [number, number, number]
const validVersion = (text: string) => /^\d+\.\d+\.\d+$/.test(text) && text.split('.').every(n => Number.isSafeInteger(Number(n)) && Number(n) < Number.MAX_SAFE_INTEGER)
const parseVersion = (text: string) => text.split('.').map(Number) as Version
const compare = (a: Version, b: Version) => { for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1 } return 0 }
export function versionMatches(version: string, conditions: VersionCondition[]): boolean {
  if (!validVersion(version)) return false
  return conditions.every(c => {
    if (!validVersion(c.value)) return false
    const cmp = compare(parseVersion(version), parseVersion(c.value))
    return c.operator === '=' ? cmp === 0 : c.operator === '>' ? cmp > 0 : c.operator === '>=' ? cmp >= 0 : c.operator === '<' ? cmp < 0 : c.operator === '<=' ? cmp <= 0 : false
  })
}
export function versionRangeExists(conditions: VersionCondition[]): boolean {
  if (conditions.some(c => !validVersion(c.value) || !['>', '>=', '=', '<', '<='].includes(c.operator))) return false
  let lower: Version = [0, 0, 0]
  for (const c of conditions) {
    if (['>', '>=', '='].includes(c.operator)) {
      const candidate = parseVersion(c.value)
      if (c.operator === '>') candidate[2]++
      if (compare(candidate, lower) > 0) lower = candidate
    }
  }
  return versionMatches(lower.join('.'), conditions)
}
export function validateTarget(target: Target): string[] {
  const errors: string[] = []
  if (!target.countries.length) errors.push('请选择至少一个 IP 国家。')
  if (target.countries.some(c => !countries.some(x => x.value === c))) errors.push('国家选项无效。')
  if (!target.platforms.length || target.platforms.some(p => !['iOS', 'Android'].includes(p))) errors.push('请选择 iOS 或 Android。')
  if (!versionRangeExists(target.versions)) errors.push('App 版本条件无效或没有交集，请检查版本号及上下界。')
  return errors
}
export function targetsOverlap(a: Target, b: Target): boolean {
  const countryOverlap = a.countries.includes('*') || b.countries.includes('*') || a.countries.some(c => b.countries.includes(c))
  return countryOverlap && a.platforms.some(p => b.platforms.includes(p)) && versionRangeExists([...a.versions, ...b.versions])
}
export function targetSummary(target: Target): string {
  return `${target.countries.map(c => countries.find(x => x.value === c)?.label ?? c).join('、') || '未选择国家'} · ${target.platforms.join(' / ') || '未选择终端'} · ${target.versions.length ? target.versions.map(c => `${c.operator} ${c.value || '待填写'}`).join(' 且 ') : '全部版本'}`
}
export function experimentState(exp: Experiment, now = Date.now()): '草稿' | '待开始' | '进行中' | '已结束' | '已关闭' {
  if (exp.status === 'draft') return '草稿'
  if (exp.status === 'closed') return '已关闭'
  if (new Date(exp.endAt).getTime() <= now) return '已结束'
  return new Date(exp.startAt).getTime() > now ? '待开始' : '进行中'
}
export const weightTotal = (variants: Variant[]) => variants.reduce((sum, v) => sum + Math.round(v.weight * 100), 0) / 100
function validatePlan(plan: Plan): string[] {
  const errors: string[] = []
  if (!templates.some(t => t.id === plan.template)) errors.push('请选择可用的流程模板。')
  for (const [lang, copies] of Object.entries({ zh: plan.copy, ...plan.translations })) {
    for (const [node, text] of Object.entries(copies)) {
      if (!['static', 'breathe', 'shake'].includes(text.animation)) errors.push(`${lang} / ${labels[node]}：按钮动效无效。`)
      if (!text.button.trim()) errors.push(`${lang} / ${labels[node]}：请填写按钮文案。`)
    }
  }
  return errors
}
export function validateExperiment(exp: Experiment, now = Date.now()): string[] {
  const errors = validateTarget(exp.target)
  if (!exp.name.trim()) errors.unshift('请填写实验名称。')
  if (!Number.isFinite(exp.traffic) || exp.traffic <= 0 || exp.traffic > 100) errors.push('实验流量必须大于 0% 且不超过 100%。')
  if (exp.variants.length < 2) errors.push('实验至少需要两个分组。')
  if (exp.variants.filter(v => v.control).length !== 1) errors.push('实验必须且只能有一个对照组。')
  if (weightTotal(exp.variants) !== 100 || exp.variants.some(v => !Number.isFinite(v.weight) || v.weight <= 0 || v.weight > 100)) errors.push('各组比例必须大于 0%，合计为 100%。')
  if (exp.variants.some(v => !v.name.trim()) || new Set(exp.variants.map(v => v.name.trim())).size !== exp.variants.length) errors.push('分组名称不能为空或重复。')
  const start = exp.startMode === 'now' && exp.status === 'draft' ? now : Date.parse(exp.startAt)
  const end = Date.parse(exp.endAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) errors.push('结束时间必须晚于开始时间。')
  if (exp.status === 'draft' && exp.startMode === 'scheduled' && start <= now) errors.push('定时开始时间必须晚于当前时间。')
  if (exp.status === 'draft' && end <= now) errors.push('结束时间必须晚于当前时间。')
  exp.variants.forEach(v => errors.push(...validatePlan(v.plan).map(e => `${v.name}：${e}`)))
  return errors
}
export function validateOnline(config: OnlineConfig, all: OnlineConfig[]): string[] {
  const errors = [...validateTarget(config.target), ...validatePlan(config.plan)]
  if (!config.name.trim()) errors.unshift('请填写线上配置名称。')
  if (config.replacesId && !all.some(x => x.id === config.replacesId && x.status === 'published')) errors.push('要替换的线上版本已失效，请重新选择。')
  all.filter(x => x.status === 'published' && x.id !== config.id && x.id !== config.replacesId && targetsOverlap(x.target, config.target)).forEach(x => errors.push(`适用范围与「${x.name}」重叠，请调整范围或选择替换该配置。`))
  return errors
}
export function saveOnline(store: ABStore, config: OnlineConfig): ABStore {
  const existing = store.online.find(x => x.id === config.id)
  if (config.status !== 'draft' || (existing && existing.status !== 'draft')) throw new Error('生效版本不可直接修改，请创建新草稿。')
  return { ...store, online: [clone(config), ...store.online.filter(x => x.id !== config.id)] }
}
export function saveExperiment(store: ABStore, exp: Experiment): ABStore {
  const existing = store.experiments.find(x => x.id === exp.id)
  if (exp.status !== 'draft' || (existing && existing.status !== 'draft')) throw new Error('实验已冻结，请复制为新实验。')
  return { ...store, experiments: [clone(exp), ...store.experiments.filter(x => x.id !== exp.id)] }
}
export function enableExperiment(store: ABStore, exp: Experiment, now = Date.now()): ABStore {
  saveExperiment(store, exp)
  const errors = validateExperiment(exp, now)
  if (errors.length) throw new Error(errors.join('\n'))
  const enabled: Experiment = { ...clone(exp), status: 'enabled', startAt: exp.startMode === 'now' ? new Date(now).toISOString() : exp.startAt, updatedAt: new Date(now).toISOString() }
  return { ...store, experiments: [enabled, ...store.experiments.filter(x => x.id !== exp.id)] }
}
export function closeExperiment(store: ABStore, id: string, now = Date.now()): ABStore {
  const exp = store.experiments.find(x => x.id === id)
  if (!exp || !['待开始', '进行中'].includes(experimentState(exp, now))) throw new Error('只有待开始或进行中的实验可以关闭。')
  return { ...store, experiments: store.experiments.map(x => x.id === id ? { ...x, status: 'closed', closedAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() } : x) }
}
export function publishOnline(store: ABStore, config: OnlineConfig): ABStore {
  saveOnline(store, config)
  const errors = validateOnline(config, store.online)
  if (errors.length) throw new Error(errors.join('\n'))
  const previous = store.online.find(x => x.id === config.replacesId)
  const published: OnlineConfig = { ...clone(config), status: 'published', revision: (previous?.revision ?? 0) + 1, updatedAt: new Date().toISOString() }
  return { ...store, online: [published, ...store.online.filter(x => x.id !== config.id).map(x => x.id === config.replacesId ? { ...x, status: 'retired' as const } : x)] }
}
export function promoteVariant(exp: Experiment, variant: Variant): OnlineConfig {
  if (exp.status === 'draft') throw new Error('实验开启后才可将组配置转为线上方案。')
  return { ...newOnline(), name: `${exp.name} · ${variant.name}转线上`, target: clone(exp.target), plan: clone(variant.plan), source: `${exp.name} / ${variant.name}` }
}
export const toDateInput = (iso: string) => iso && Number.isFinite(Date.parse(iso)) ? new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 16) : ''
export const fromDateInput = (value: string) => value && Number.isFinite(Date.parse(`${value}:00+08:00`)) ? new Date(`${value}:00+08:00`).toISOString() : ''
export const formatDate = (iso: string) => toDateInput(iso).replace('T', ' ') || '未设置'
