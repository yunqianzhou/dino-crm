import { useI18n } from '../i18n'

export default function MarketingCenterPrototype({ page = 'links' }: { page?: 'channels' | 'skus' | 'sets' | 'links' }) {
  const { lang } = useI18n()
  return (
    <iframe
      title="Dino English 营销中心"
      src={`/dino-crm/marketing-center-demo.html?embedded=1&lang=${lang === 'en' ? 'en' : 'zh'}&page=${page}&v=20260902-lpid1`}
      style={{ width: '100%', height: 'calc(100vh - 96px)', border: 0, display: 'block' }}
    />
  )
}
