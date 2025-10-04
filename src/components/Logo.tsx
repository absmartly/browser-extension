import logoUrl from "data-base64:~assets/logo.png"

interface LogoProps {
  config?: any
  className?: string
}

export function Logo({ config, className = "w-10 h-10" }: LogoProps) {
  const baseUrl = config?.apiEndpoint
    ? config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
    : undefined

  const handleClick = (e: React.MouseEvent) => {
    if (baseUrl) {
      e.preventDefault()
      chrome.tabs.create({ url: baseUrl })
    }
  }

  const Logo = baseUrl ? 'a' : 'div'

  return (
    <div className="relative inline-block">
      <Logo
        href={baseUrl}
        onClick={baseUrl ? handleClick : undefined}
        className={baseUrl ? "cursor-pointer" : ""}
        title={baseUrl ? "Open ABsmartly" : undefined}
      >
        <img
          src={logoUrl}
          alt="ABsmartly"
          className={`${className} ${config?.apiEndpoint ? 'hover:opacity-80 transition-opacity' : ''}`}
        />
      </Logo>
      <span className="absolute -top-0.5 -right-2 px-1 py-0.5 text-[8px] font-semibold text-orange-600 bg-orange-100 rounded leading-none">
        BETA
      </span>
    </div>
  )
}
