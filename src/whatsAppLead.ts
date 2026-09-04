import type { BusinessLine } from './types'

export const WHATSAPP_LEAD_CHANNEL_CODE = 'leads_whatsapp'

export type WhatsAppLead = {
  nickname: string
  phone: string
  countryCode: string
  country: string
  businessLine: BusinessLine
}

type Location = Omit<WhatsAppLead, 'nickname' | 'phone'>

// Use the longest prefix first: 60 must not be mistaken for 6, for example.
const COUNTRY_BY_PREFIX: Array<[string, Omit<Location, 'countryCode'>]> = [
  ['966', { country: '沙特', businessLine: '沙特' }],
  ['886', { country: '中国台湾', businessLine: '其他' }],
  ['852', { country: '中国香港', businessLine: '其他' }],
  ['84', { country: '越南', businessLine: '越南' }],
  ['82', { country: '韩国', businessLine: '韩国' }],
  ['66', { country: '泰国', businessLine: '泰国' }],
  ['65', { country: '新加坡', businessLine: '新加坡' }],
  ['62', { country: '印尼', businessLine: '印尼' }],
  ['60', { country: '马来西亚', businessLine: '马来' }],
  ['86', { country: '中国', businessLine: '其他' }],
  ['1', { country: '美国/加拿大', businessLine: '其他' }],
]

export function locationFromPhone(phone: string): Location {
  const digits = phone.replace(/\D/g, '')
  const matched = COUNTRY_BY_PREFIX.find(([prefix]) => digits.startsWith(prefix))
  if (!matched) return { countryCode: '', country: '其他', businessLine: '其他' }
  return { countryCode: `+${matched[0]}`, ...matched[1] }
}

export function phoneKey(phone: string) {
  return phone.replace(/\D/g, '')
}

/**
 * Parses the notification format sent by the WhatsApp bot to the Lark group.
 * It intentionally accepts both English and Chinese labels and whitespace around colons.
 */
export function parseWhatsAppGroupMessages(raw: string): WhatsAppLead[] {
  const leadPattern = /(?:Customer\s*name|客户(?:昵称|姓名)?|nickname)\s*[:：]\s*([^\r\n]+)[\s\S]{0,500}?(?:Mobile\s*number|phone(?:\s*number)?|手机(?:号|号码)?)\s*[:：]\s*(\+?[\d\s().-]{6,})/gi
  const leads: WhatsAppLead[] = []
  let matched: RegExpExecArray | null
  while ((matched = leadPattern.exec(raw))) {
    const nickname = matched[1].trim().replace(/\s+/g, ' ')
    const digits = phoneKey(matched[2])
    if (!nickname || digits.length < 6) continue
    const location = locationFromPhone(digits)
    leads.push({ nickname, phone: `${location.countryCode}${location.countryCode ? ' ' : ''}${digits.slice(location.countryCode.replace('+', '').length)}`, ...location })
  }
  return leads
}
