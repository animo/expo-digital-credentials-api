import type { DigitalCredentialsRequest, JsonObject } from '@animo-id/expo-digital-credentials-api'

/**
 * Transaction data selected for one DCQL slot.
 */
export type AptitudeSelectionTransactionData = JsonObject & {
  /**
   * Index in the request `transaction_data` array.
   */
  index: number
  /**
   * True when the transaction data was shown in dedicated UI, for example payment/SCA.
   */
  displayed: boolean
}

/**
 * Aptitude Consortium matcher-specific metadata attached to selections.
 */
export type AptitudeSelectionMetadata = JsonObject & {
  /**
   * DCQL credential id for the selected query entry.
   */
  dcql_id: string
  /**
   * Credential id used by the matcher for the selected credential.
   */
  credential_id: string
  /**
   * Transaction data associated with this selected credential, when present.
   */
  transaction_data?: AptitudeSelectionTransactionData
}

export type AptitudeEmptyEntryId = '__none__' | `__none__:${string}`

export type AptitudeSelectionCredential = Omit<
  NonNullable<NonNullable<DigitalCredentialsRequest['selection']>['creds']>[number],
  'metadata' | 'entryId'
> & {
  /**
   * Selected credential entry id. Empty slots use the `__none__` sentinel (optionally with a suffix).
   */
  entryId: string | AptitudeEmptyEntryId
  metadata?: AptitudeSelectionMetadata
}

export type AptitudeSelectionSlot = {
  /**
   * DCQL credential id for the selected query entry.
   */
  dcql_id: string
  /**
   * Selected credential entry id. Empty slots use the `__none__` sentinel.
   */
  entryId: string | AptitudeEmptyEntryId
  /**
   * Credential id used by the matcher for the selected credential.
   */
  credential_id: string
  /**
   * Transaction data associated with this selected credential, when present.
   */
  transaction_data?: AptitudeSelectionTransactionData
}

export type DigitalCredentialsRequestWithAptitudeSelection = Omit<DigitalCredentialsRequest, 'selection'> & {
  selection?: Omit<NonNullable<DigitalCredentialsRequest['selection']>, 'creds'> & {
    creds: AptitudeSelectionCredential[]
    slots: AptitudeSelectionSlot[]
  }
}

/**
 * Helper to access Aptitude Consortium matcher selection metadata with typing.
 */
export function getAptitudeSelection(
  request: DigitalCredentialsRequest
): DigitalCredentialsRequestWithAptitudeSelection['selection'] | undefined {
  if (!request.selection) return undefined

  const creds = request.selection.creds.map((cred) => {
    return { ...cred, metadata: cred.metadata as AptitudeSelectionMetadata | undefined }
  })
  const slots: AptitudeSelectionSlot[] = []

  for (const cred of creds) {
    if (!cred.metadata) continue

    slots.push({
      dcql_id: cred.metadata.dcql_id,
      entryId: cred.entryId,
      credential_id: cred.metadata.credential_id,
      ...(cred.metadata.transaction_data ? { transaction_data: cred.metadata.transaction_data } : {}),
    })
  }

  return {
    ...request.selection,
    creds,
    slots,
  }
}
