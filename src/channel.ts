import { BUSINESS_LINES } from './types'
import type { ChannelLevelNode, ChannelLine } from './types'

// 依据渠道 code，返回其在渠道树中的完整路径（渠道类型 / 一级 / 二级…），
// 即该 code 归因到的「最低级别渠道」。找不到返回 null。
export function channelPathByCode(channels: ChannelLine[], code?: string): string | null {
  if (!code) return null
  for (const line of channels) {
    for (const tp of line.children) {
      const walk = (nodes: ChannelLevelNode[], names: string[]): string | null => {
        for (const n of nodes) {
          if (n.code === code) return [tp.name, ...names, n.name].join(' / ')
          const deeper = walk(n.children, [...names, n.name])
          if (deeper) return deeper
        }
        return null
      }
      const found = walk(tp.children, [])
      if (found) return found
    }
  }
  return null
}

type ChannelUser = {
  businessLine: string
  registerChannel: string
  channelCode?: string
  channelSource?: string
  country?: string
  adChannel?: string
  subChannel?: string
}

// 渠道来源展示（用户中心一期）：
// 1) 有渠道 code（落地页投放）：展示广告渠道名称；
// 2) 无渠道 code（直接投 App）：展示三方归因「投放渠道 / 子渠道」。
export function channelSourceText(channels: ChannelLine[], s: ChannelUser): string {
  if (s.channelCode) {
    return s.adChannel || channelPathByCode(channels, s.channelCode) || s.registerChannel || '—'
  }
  const parts = [s.adChannel, s.subChannel].filter(Boolean)
  if (parts.length) return parts.join(' / ')
  return s.channelSource || s.registerChannel || '—'
}

export function lpChannelSourceText(channels: ChannelLine[], s: ChannelUser): string {
  if (!s.channelCode) return '—'
  return s.adChannel || channelPathByCode(channels, s.channelCode) || s.registerChannel || '—'
}

export function appChannelSourceText(s: ChannelUser): string {
  if (s.channelCode) return '—'
  const parts = [s.adChannel, s.subChannel].filter(Boolean)
  if (parts.length) return parts.join(' / ')
  return s.channelSource || s.registerChannel || '—'
}

// 业务线展示：CRM 渠道仅用于投放落地页配置，无渠道码（仅投 App）的用户
// 业务线取「注册时的国家」；有落地页渠道码的用户，国家即业务线，二者一致。
export function lineLabel(s: { businessLine: string; country?: string }): string {
  return s.country || s.businessLine
}

// 是否为「有落地页渠道码」的用户（渠道码能在渠道树中解析到实际渠道）
export function hasLandingChannel(channels: ChannelLine[], s: ChannelUser): boolean {
  return !!channelPathByCode(channels, s.channelCode)
}

// 业务线展示：如果用户数据中包含业务线，则直接展示。
// 某些特殊 App 渠道进来的可能没有业务线，则为空。
export function channelLineByCode(channels: ChannelLine[], code?: string): string | null {
  if (!code) return null
  for (const line of channels) {
    for (const tp of line.children) {
      const walk = (nodes: ChannelLevelNode[]): boolean => {
        for (const n of nodes) {
          if (n.code === code) return true
          if (walk(n.children)) return true
        }
        return false
      }
      if (walk(tp.children)) return line.name
    }
  }
  return null
}

export function businessLineOf(channels: ChannelLine[], s: ChannelUser): string {
  // 有渠道code的，可以关联业务线，则按照业务线关联数据
  if (s.channelCode) {
    const line = channelLineByCode(channels, s.channelCode)
    if (line) return line
  }
  
  // 没有渠道code，按照国家映射到业务线上
  if (s.country) {
    // 处理一些别名，比如 马来西亚 -> 马来
    const normalizedCountry = s.country === '马来西亚' ? '马来' : s.country
    
    if (BUSINESS_LINES.includes(normalizedCountry as any) && normalizedCountry !== '其他') {
      return normalizedCountry
    }
    // 国家与业务线映射不上的，则归为其他业务线
    return '其他'
  }
  
  return s.businessLine || '其他'
}

// 注册渠道/渠道来源展示：
// 1) 有落地页渠道码：解析到最低级别渠道路径；
// 2) 无渠道码（仅投 App）：用线下导表「投放渠道」(channelSource) 回填渠道来源。
export function registerChannelText(channels: ChannelLine[], s: ChannelUser): string {
  const line = lineLabel(s)
  const path = channelPathByCode(channels, s.channelCode)
  if (path) return `${line} · ${path}`
  const source = s.channelSource || s.registerChannel
  return source ? `${line} · ${source}` : line
}
