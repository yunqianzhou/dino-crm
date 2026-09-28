import { Checkbox, DatePicker, Select, Typography } from 'antd'
import dayjs from 'dayjs'
import { useI18n } from '../i18n'
import type { SalesTimeQuery5 } from '../review5'

export default function SalesTimeFilter5({ value, onChange }: { value: SalesTimeQuery5; onChange: (value: SalesTimeQuery5) => void }) {
  const { t } = useI18n()
  return <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <Select aria-label={t('sales.time5.type')} style={{ width: 190 }} value={value.kind}
        options={(['register', 'follow', 'appointment', 'callback'] as const).map(kind => ({ value: kind, label: t(`sales.time5.${kind}`) }))}
        onChange={kind => onChange({ ...value, kind, range: null, callback: 'all', noAppointment: kind === 'appointment' ? false : value.noAppointment })} />
      <DatePicker.RangePicker aria-label={t('sales.time5.range')} style={{ width: 340, maxWidth: '100%' }} value={value.range}
        disabled={value.kind === 'callback' && value.callback !== 'all'}
        placeholder={[t('sales.time5.from'), t('sales.time5.to')]}
        onChange={range => onChange({ ...value, range })}
        presets={[
          { label: t('sales.time5.today'), value: () => [dayjs().startOf('day'), dayjs().endOf('day')] },
          { label: t('sales.time5.last7'), value: () => [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')] },
          { label: t('sales.time5.last30'), value: () => [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')] },
        ]} />
      {value.kind === 'callback' && <Select aria-label={t('sales.time5.window')} style={{ width: 170 }} value={value.callback}
        options={(['all', 'due', 'upcoming'] as const).map(window => ({ value: window, label: t(`sales.time5.${window}`) }))}
        onChange={callback => onChange({ ...value, callback, range: null })} />}
      <Checkbox checked={value.noAppointment} onChange={event => onChange({ ...value, noAppointment: event.target.checked,
        ...(event.target.checked && value.kind === 'appointment' ? { kind: 'follow', range: null } : {}) })}>{t('sales.time5.noAppointment')}</Checkbox>
    </div>
    {(value.kind === 'appointment' || value.kind === 'callback') && <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
      {t(`sales.time5.${value.kind}Hint`)}
    </Typography.Text>}
  </div>
}
