import logoUrl from "data-base64:~assets/logo.png"

interface LogoProps {
  config?: any
  className?: string
}

export function Logo({ config, className = "w-10 h-10" }: LogoProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (config?.apiEndpoint) {
      e.preventDefault()
      const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
      chrome.tabs.create({ url: baseUrl })
    }
  }

  const Logo = config?.apiEndpoint ? 'a' : 'div'

  return (
    <div className="relative inline-block">
      <Logo
        href={config?.apiEndpoint ? "#" : undefined}
        onClick={config?.apiEndpoint ? handleClick : undefined}
        className={config?.apiEndpoint ? "cursor-pointer" : ""}
        title={config?.apiEndpoint ? "Open ABsmartly" : undefined}
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
