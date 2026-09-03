import { useI18n } from '../i18n'
import { useLocation } from 'react-router-dom'
import { usePerm } from '../perm'

export default function MarketingCenterPrototype({ page = 'links' }: { page?: 'channels' | 'skus' | 'sets' | 'links' }) {
  const { lang } = useI18n()
  const { can } = usePerm()
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
  const allowed = (permission: ReturnType<typeof can>) => permission === 'operate'
  const permissions = new URLSearchParams({
    perm_channelWrite: allowed(can('marketingV2_channels_edit')) ? '1' : '0',
    perm_channelStatus: allowed(can('marketingV2_channels_status')) ? '1' : '0',
    perm_offerWrite: allowed(can('marketingV2_offers_edit')) ? '1' : '0',
    perm_offerStatus: allowed(can('marketingV2_offers_status')) ? '1' : '0',
    perm_landingCreate: allowed(can('marketingV2_landing_create')) ? '1' : '0',
    perm_landingEdit: allowed(can('marketingV2_landing_edit')) ? '1' : '0',
    perm_landingStatus: allowed(can('marketingV2_landing_status')) ? '1' : '0',
    perm_landingCopy: can('marketingV2_landing_copy') === 'none' ? '0' : '1',
    perm_landingPreview: allowed(can('marketingV2_landing_preview')) ? '1' : '0',
  })
  const src = `/dino-crm/marketing-center-demo.html?embedded=1&lang=${lang === 'en' ? 'en' : 'zh'}&page=${currentPage}&${permissions.toString()}&v=20260903-scopeperm2`
  return (
    <iframe
      key={src}
      title="Dino English 营销中心"
      src={src}
      style={{ width: '100%', height: 'calc(100vh - 96px)', border: 0, display: 'block' }}
    />
  )
}
