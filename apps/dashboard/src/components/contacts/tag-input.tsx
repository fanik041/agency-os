'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateContactTagsAction } from '@/app/contacts/actions'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'

export function TagInput({
  contactId,
  tags,
  onTagsChange,
}: {
  contactId: string
  tags: string[]
  onTagsChange?: (tags: string[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    const tag = value.trim().toLowerCase()
    if (!tag || tags.includes(tag)) {
      setValue('')
      return
    }
    const newTags = [...tags, tag]
    setValue('')
    setEditing(false)
    startTransition(async () => {
      try {
        await updateContactTagsAction(contactId, newTags)
        onTagsChange?.(newTags)
      } catch {
        toast.error('Failed to add tag')
      }
    })
  }

  function handleRemove(tag: string) {
    const newTags = tags.filter((t) => t !== tag)
    startTransition(async () => {
      try {
        await updateContactTagsAction(contactId, newTags)
        onTagsChange?.(newTags)
      } catch {
        toast.error('Failed to remove tag')
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    } else if (e.key === 'Escape') {
      setEditing(false)
      setValue('')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 text-xs">
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRemove(tag)
            }}
            className="ml-0.5 rounded-full hover:bg-muted"
            disabled={isPending}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (value.trim()) handleAdd()
            else setEditing(false)
          }}
          className="h-6 w-24 text-xs"
          placeholder="tag..."
        />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
          disabled={isPending}
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
