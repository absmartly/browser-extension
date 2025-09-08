import React from 'react'

interface AlertProps {
  children: React.ReactNode
  variant?: 'default' | 'destructive'
  className?: string
}

interface AlertDescriptionProps {
  children: React.ReactNode
}

export const Alert: React.FC<AlertProps> = ({ 
  children, 
  variant = 'default',
  className = '' 
}) => {
  const variantClasses = {
    default: 'bg-blue-50 border-blue-200 text-blue-800',
    destructive: 'bg-red-50 border-red-200 text-red-800'
  }

  return (
    <div className={`flex gap-2 p-4 border rounded-lg ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  )
}

export const AlertDescription: React.FC<AlertDescriptionProps> = ({ children }) => {
  return (
    <div className="text-sm">
      {children}
    </div>
  )
}