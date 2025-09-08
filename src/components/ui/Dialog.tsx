import React from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps {
  children: React.ReactNode
  className?: string
}

interface DialogHeaderProps {
  children: React.ReactNode
}

interface DialogTitleProps {
  children: React.ReactNode
  className?: string
}

interface DialogFooterProps {
  children: React.ReactNode
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50">
        {children}
      </div>
    </div>
  )
}

export const DialogContent: React.FC<DialogContentProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto flex flex-col ${className}`}>
      {children}
    </div>
  )
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => {
  return (
    <div className="px-6 py-4 border-b border-gray-200">
      {children}
    </div>
  )
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ children, className = '' }) => {
  return (
    <h2 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h2>
  )
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ children }) => {
  return (
    <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
      {children}
    </div>
  )
}

export const DialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <p className="text-sm text-gray-500 mt-1">
      {children}
    </p>
  )
}