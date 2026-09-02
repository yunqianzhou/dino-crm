import { useI18n } from '../i18n'
import { useLocation } from 'react-router-dom'

export default function MarketingCenterPrototype({ page = 'links' }: { page?: 'channels' | 'skus' | 'sets' | 'links' }) {
  const { lang } = useI18n()
  const location = useLocation()
  // The menu and the embedded prototype are separate pages. Resolve the page
  // from the active route as well, so switching menu entries cannot leave the
  // iframe on the previously rendered landing-page view.
  const pathParts = location.pathname.split('/')
  const routePage = pathParts[pathParts.length - 1]
  const currentPage = routePage === 'channels'
    ? 'channels'
    : routePage === 'skus'
      ? 'skus'
      : routePage === 'offers'
        ? 'sets'
        : routePage === 'landing'
          ? 'links'
          : page
  const src = `/dino-crm/marketing-center-demo.html?embedded=1&lang=${lang === 'en' ? 'en' : 'zh'}&page=${currentPage}&v=20260902-routefix1`
  return (
    <iframe
      key={src}
      title="Dino English 营销中心"
      src={src}
      style={{ width: '100%', height: 'calc(100vh - 96px)', border: 0, display: 'block' }}
    />
  )
}
