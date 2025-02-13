export interface CredentialEntryField {
  name: string
  value?: string
  displayName: string // display_name
  displayValue?: string // display_value
}

export interface CredentialEntry {
  id: string
  credential: {
    format: 'mso_mdoc' // only mso_mdoc supported for now
    displayInfo: {
      // display_info
      title: string
      subtitle?: string
      disclaimer?: string
      warning?: string

      // Index? (probably easier to make this the icon data url)
      iconId?: number // icon_id
    }

    fields: CredentialEntryField[]
  }
}

export interface RegisterCredentialsOptions {
  credentials: Array<CredentialEntry>
}

export type OnRequestEventPayload = {
  request: string
}

export type DigitalCredentialsApiModuleEvents = {
  onRequest: (params: OnRequestEventPayload) => void
}
