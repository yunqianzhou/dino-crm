import { Select } from 'antd'
import { useI18n } from '../i18n'

// 业务线多选筛选（默认勾选账号数据权限内的业务线，可自行增减）
export default function LineFilter({
  value,
  onChange,
  options,
  width = 220,
  placeholder,
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  options: string[]
  width?: number
  placeholder?: string
  disabled?: boolean
}) {
  const { t } = useI18n()
  return (
    <Select
      mode="multiple"
      allowClear={!disabled}
      maxTagCount="responsive"
      placeholder={placeholder || t('user.col.line')}
      style={{ minWidth: width }}
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={options.map((l) => ({ label: l, value: l }))}
    />
  )
}
