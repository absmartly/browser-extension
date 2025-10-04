import logoUrl from "data-base64:~assets/logo.png"

interface LogoProps {
  config?: any
  className?: string
}

export function Logo({ config, className = "w-8 h-8" }: LogoProps) {
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
      <span className="absolute -top-0.5 -right-4 px-1 py-0.5 text-[9px] font-semibold text-blue-600 bg-blue-100 rounded leading-none">
        BETA
      </span>
    </div>
  )
}
