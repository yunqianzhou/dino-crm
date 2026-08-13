import { useEffect, useState } from 'react'
import { usePerm } from './perm'

// 业务线「默认勾选」：
// 依据账号的数据权限，默认勾选其业务线；但并非真正的数据隔离，
// 用户可自行改选，查看其他业务线的数据。selected 为空表示不过滤（全部）。
export function useLineScope() {
  const { account, allowedLines } = usePerm()
  const scope = allowedLines()
  const isRestricted = scope !== null
  
  // 如果受限，默认选中其权限内的第一个；如果不受限，默认全不选
  const defaultLines = isRestricted && scope.length > 0 ? [scope[0]] : []
  
  const [selected, setSelected] = useState<string[]>(defaultLines)

  // 切换身份/账号时，重置
  useEffect(() => {
    setSelected(isRestricted && scope.length > 0 ? [scope[0]] : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id])

  const matchLine = (line: string) => {
    if (isRestricted && !scope.includes(line)) return false
    return selected.length === 0 || selected.includes(line)
  }

  const filterOptions = (options: string[]) => {
    if (isRestricted) return options.filter(o => scope.includes(o))
    return options
  }

  return { 
    selected, 
    setSelected, 
    matchLine,
    disabled: false, // 允许修改，不再禁用
    filterOptions
  }
}
