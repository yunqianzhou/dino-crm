import type { PageCopy, Plan, Target } from './abTestConfig'
export type Asset = { mode: 'inherit' | 'custom' | 'hidden'; src?: string; name?: string; mime?: string; width?: number; height?: number; bytes?: number }
export type PageItem = { id: string; label: string; body?: string; asset?: Asset; values?: string[] }
export type PageDetails = { texts: Record<string, string>; assets: Record<string, Asset>; lists: Record<string, PageItem[]>; settings: Record<string, string | number | boolean | string[]> }
export const inheritedAsset = (): Asset => ({ mode: 'inherit' })
export const animations = [{ value: 'static', label: '静态' }, { value: 'breathe', label: '呼吸动效' }, { value: 'shake', label: '抖动动效' }]
export const loginMethods = [{ id: 'google', label: 'Google' }, { id: 'apple', label: 'Apple' }, { id: 'phone', label: '手机号' }, { id: 'facebook', label: 'Facebook' }, { id: 'kakao', label: 'Kakao' }]
export const ageLabels = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13+']
export const levelLabels = ['刚起步，认识 hello 和 bye', '认识常见单词，还不会组成句子', '能读简单句子、做简短回答', '能独立读故事、谈论经历']
export function defaultPageDetails(node: string, copy?: PageCopy): PageDetails {
 const d: PageDetails = { texts: {}, assets: {}, lists: {}, settings: {} }
 const row = (id: string, label: string): PageItem => ({ id, label })
 if (node === 'value') { d.lists.heroes = [{ ...row('hero-1', '宣传图 1'), asset: inheritedAsset() }]; d.texts.accountHint = '已有账号？'; d.texts.accountAction = '登录'; d.settings.accountAnimation = 'static' }
 if (node === 'auth') { d.lists.slides = [{ id: 'slide-1', label: copy?.title ?? '让孩子自信开口说英语', body: copy?.body ?? '陪伴孩子的英语成长', asset: inheritedAsset() }]; d.settings.loginMethods = ['google', 'apple', 'phone', 'facebook', 'kakao']; loginMethods.forEach(m => { d.settings[`animation_${m.id}`] = 'static' }); d.assets.background = inheritedAsset() }
 if (['name', 'age', 'level', 'goal'].includes(node)) d.assets.background = inheritedAsset()
 if (node === 'name') { d.texts.placeholder = '孩子的名字或昵称'; d.texts.guide = '嗨，我是 Dino！回答几个小问题，找到适合你的起点。'; d.lists.names = ['Ethan', 'Liam', 'Noah', 'Mia', 'Emma', 'Olivia'].map((x, i) => row(`name-${i}`, x)); d.assets.guide = inheritedAsset(); d.settings.showGuide = true }
 if (node === 'age') d.lists.options = ageLabels.map((x, i) => row(`age-${i + 3}`, x))
 if (node === 'level') d.lists.options = levelLabels.map((x, i) => row(`level-${i + 1}`, x))
 if (node === 'goal') d.lists.options = ['自信开口说英语', '提升校内英语表现', '打好英语基础', '在生活中使用英语', '养成持续学习习惯'].map((x, i) => ({ ...row(`goal-${i + 1}`, x), asset: inheritedAsset() }))
 if (node.startsWith('paywall')) {
  d.lists.slides = [{ id: 'intro-1', label: copy?.title ?? '陪伴孩子成长', body: copy?.body ?? '开启英语学习旅程', asset: inheritedAsset() }]
  d.settings.featureMode = 'table'; d.assets.feature = inheritedAsset(); d.texts.benefitHeading = '学习权益'; d.texts.proHeading = 'Dino Pro'; d.texts.maxHeading = 'Dino Max'
  d.lists.benefits = [{id:'benefit-1',label:'每周 AI 课程',values:['3','5']},{id:'benefit-2',label:'学习进度',values:['1x','1.7x']},{id:'benefit-3',label:'课后学习报告',values:['✓','✓']}]
  d.settings.productMode = 'inherit'; d.settings.skus = []; d.settings.defaultSku = ''; d.settings.nameSize = 18; d.settings.priceSize = 16; d.settings.nameColor = '#27344a'; d.settings.priceColor = '#27344a'; d.settings.strikethrough = false
  d.settings.offerMode = 'countdown'; d.texts.offerTitle = '限时优惠'; d.assets.offer = inheritedAsset()
 }
 if (node.startsWith('retention-')) {
  d.texts.badge = node.endsWith('promo') ? '专属优惠已解锁' : '给你的一份特别优惠'; d.settings.offerMode = 'countdown'; d.texts.offerTitle = '优惠即将结束'; d.assets.offer = inheritedAsset(); d.settings.productMode = 'inherit'; d.settings.period = 'monthly'; d.settings.skus = []
 }
 return d
}
export function pageDetails(plan: Plan, node: string): PageDetails { return plan.pages?.[node] ?? defaultPageDetails(node, plan.copy[node]) }
export function previewVariables(text: string, nickname: string, level: string): string { return text.split('{昵称}').join(nickname).split('{当前定级}').join(level) }
export function validAssetSource(src: string): boolean { return /^asset:[\w-]+$/.test(src) || /^https:\/\//i.test(src) && (() => { try { const u = new URL(src); return Boolean(u.hostname) && !u.username && !u.password } catch { return false } })() }
export function demoProducts(target: Target) {
 const countries = target.countries.includes('*') ? ['SA', 'MY', 'US'] : target.countries
 return countries.flatMap(country => target.platforms.flatMap(platform => [{ code:'pro-month', label:'Dino Pro 月度' }, { code:'pro-year', label:'Dino Pro 年度' }, { code:'max-year', label:'Dino Max 年度' }].map(p => ({ id:`demo-${country}-${platform}-${p.code}`, label:`${p.label} · ${country} / ${platform}`, country, platform }))))
}
export function validatePageDetails(plan: Plan, target?: Target): string[] {
 const errors: string[] = []
 for (const [node, d] of Object.entries(plan.pages ?? {})) {
  const assets = [...Object.entries(d.assets), ...Object.values(d.lists).flatMap(list => list.filter(x => x.asset).map(x => [x.id, x.asset!] as const))]
  assets.forEach(([slot, asset]) => { if (asset.mode === 'custom' && !validAssetSource(asset.src ?? '')) errors.push(`${node} / ${slot}：请上传素材或填写有效 HTTPS 图片地址。`) })
  for (const [key, list] of Object.entries(d.lists)) if (new Set(list.map(x => x.id)).size !== list.length) errors.push(`${node} / ${key}：选项编号不能重复。`)
  if (node === 'age' || node === 'level') { const fixed = defaultPageDetails(node).lists.options; if (JSON.stringify(d.lists.options?.map(x => x.id)) !== JSON.stringify(fixed.map(x => x.id))) errors.push(`${node}：选项编号、数量和顺序必须保持现有规则。`) }
  if (node === 'auth') { const methods = d.settings.loginMethods as string[]; if (!methods?.length || methods.some(x => !loginMethods.some(m => m.id === x))) errors.push('注册登录：至少保留一种已支持的登录方式。') }
  if ((node.startsWith('paywall') || node === 'retention-regular') && d.settings.productMode === 'custom') {
   const skus = d.settings.skus as string[]
   if (!skus?.length) errors.push(`${node}：请选择至少一个商品。`)
   if (node.startsWith('paywall') && !skus.includes(String(d.settings.defaultSku))) errors.push(`${node}：默认套餐必须在已选商品列表内。`)
   if (target && skus.some(id => !demoProducts(target).some(p => p.id === id))) errors.push(`${node}：已选商品不在当前国家、平台的演示商品范围内。`)
  }
  if (node.startsWith('retention-') && !d.texts.badge?.trim()) errors.push(`${node}：宣传标签固定展示，请填写文案。`)
  assets.forEach(([slot, asset]) => { if (asset.mode === 'custom' && (asset.mime === 'image/gif' || /\.gif(?:[?#]|$)/i.test(asset.src ?? '')) && !node.startsWith('paywall') && !(node.startsWith('retention-') && slot === 'offer')) errors.push(`${node} / ${slot}：此资源位仅支持静态图片。`) })
  if (node.startsWith('paywall')) for (const key of ['nameSize', 'priceSize']) if (!Number.isFinite(d.settings[key]) || Number(d.settings[key]) < 10 || Number(d.settings[key]) > 36) errors.push(`${node}：演示商品字号需在 10–36 之间。`)
  if (node.startsWith('paywall')) for (const key of ['nameColor', 'priceColor']) if (!/^#[0-9a-f]{6}$/i.test(String(d.settings[key]))) errors.push(`${node}：商品色值需为六位十六进制颜色。`)
 }
 for (const [language, pages] of Object.entries(plan.pageTranslations ?? {})) for (const [node, texts] of Object.entries(pages)) if (node.startsWith('retention-') && texts.badge !== undefined && !texts.badge.trim()) errors.push(`${node}：${language} 宣传标签固定展示，不能清空。`)
 const names: Record<string, string> = {value:'首启价值页',auth:'注册登录',name:'孩子称呼',age:'孩子年龄',level:'英语水平',goal:'学习目标',paywall:'主购买页','paywall-before':'课前购买页','paywall-after':'课后购买页','retention-promo':'挽留支付 Promo','retention-regular':'普通挽留'}
 return errors.map(error => error.replace(/^[\w-]+/, node => names[node] ?? node))
}
