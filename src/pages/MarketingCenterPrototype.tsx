import { useI18n } from '../i18n'

export default function MarketingCenterPrototype() {
  const { lang } = useI18n()
  return (
    <iframe
      title="Dino English 营销中心"
      src={`/dino-crm/marketing-center-demo.html?embedded=1&lang=${lang === 'en' ? 'en' : 'zh'}`}
      style={{ width: '100%', height: 'calc(100vh - 96px)', border: 0, display: 'block' }}
    />
  )
}
