import logoUrl from "data-base64:~assets/logo.png"

interface LogoProps {
  config?: any
  className?: string
}

export function Logo({ config, className = "w-6 h-6" }: LogoProps) {
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
      <span className="absolute -top-1 -right-2 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 bg-blue-100 rounded-md leading-none">
        BETA
      </span>
    </div>
  )
}
