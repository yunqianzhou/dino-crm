import { DatePicker, Select, Typography } from 'antd'
import dayjs from 'dayjs'
import { useI18n } from '../i18n'
import { changeSalesTimeKind5, type SalesTimeQuery5 } from '../review5'

export default function SalesTimeFilter5({ value, onChange }: { value: SalesTimeQuery5; onChange: (value: SalesTimeQuery5) => void }) {
  const { t } = useI18n()
  return <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <Select aria-label={t('sales.time5.type')} style={{ width: 190 }} value={value.kind}
        options={(['register', 'follow', 'appointment', 'callback'] as const).map(kind => ({ value: kind, label: t(`sales.time5.${kind}`), disabled: (kind === 'appointment' && value.appointmentPresence === 'no') || (kind === 'callback' && value.callbackPresence === 'no') }))}
        onChange={kind => onChange(changeSalesTimeKind5(value, kind))} />
      <DatePicker.RangePicker aria-label={t('sales.time5.range')} style={{ width: 340, maxWidth: '100%' }} value={value.range}
        placeholder={[t('sales.time5.from'), t('sales.time5.to')]}
        onChange={range => onChange({ ...value, range })}
        presets={[
          { label: t('sales.time5.today'), value: () => [dayjs().startOf('day'), dayjs().endOf('day')] },
          { label: t('sales.time5.last7'), value: () => [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')] },
          { label: t('sales.time5.last30'), value: () => [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')] },
        ]} />

    </div>
    {(value.kind === 'appointment' || value.kind === 'callback') && <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
      {t(`sales.time5.${value.kind}Hint`)}
    </Typography.Text>}
  </div>
}
