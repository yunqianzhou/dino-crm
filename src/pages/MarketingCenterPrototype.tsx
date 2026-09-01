export default function MarketingCenterPrototype() {
  return (
    <iframe
      title="Dino English 营销中心"
      src={`${import.meta.env.BASE_URL}marketing-center-demo.html`}
      style={{ width: '100%', height: '100vh', border: 0, display: 'block' }}
    />
  )
}
