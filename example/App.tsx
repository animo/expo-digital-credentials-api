import { registerCredentials as registerCmWallet, type CredentialItem, type SdJwtDcClaims } from '@animo-id/expo-digital-credentials-api-cmwallet'
import {
  encodeIssuanceCreationOptions,
  registerCreationOptions as registerCmWalletIssuance,
} from '@animo-id/expo-digital-credentials-api-cmwallet-issuance'
import {
  encodeAptitudeConsortiumConfig,
  registerCredentials as registerAptitude,
} from '@animo-id/expo-digital-credentials-api-aptitude-consortium'
import { registerCredentials as registerUbique } from '@animo-id/expo-digital-credentials-api-ubique'
import { normalizeAptitudeConsortiumConfig, type AptitudeConsortiumConfigInput } from './matcherEncoding'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'

export default function App() {

  const mdlIconDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAC1klEQVR4nI1W267bNhCc2aVU5MQIkPz/f/U9SNO0fUzPObAl7uRhSZqSXaCCDZEi5bnshebvX7/LIJgk5h0mwAlRfS44OdYpQQJISBIAQBKI41wSSOaz9hySbiAsx4AAQMy19p3HfT4u3ocdLJ9zGlLz1r4rhc4ABIQTOAmRCImDxPTjIEAylTUVByJPLgNQEgygjuqUQFJnTEoQ+rxDE0QoQDOaFwAJrKiKvTJVMz+NESWUuzqCzYw+z7EONndiwz4J5bcVMOd4EgLkNKuq2zZMzrTIydHqYe9jXLvVmEIBAL6utGWhGVuyJGUzwIrDSuEz403gUPeo9kyGUygAmtPXBXUP/Pj71X7+u/GPP1/9/brzxz/vXmvQisPcU27nTbSsxlHhWe1MZqglYMsCErhed9YqXS6L3q8VRiICut6CJEEznlN7WH2296GMWtaOuRnoBghwN72+bfz67advW/D7X2/29r6zuI2CZ6+Edj8oxmQlB9ApFD07yHvNEnAj9z3kRkiC+5QL815kJUzJxQfwjnev37au5+EoxeBOuVvbkxU/Vf3Ya/8V22cdayYw2iABBVCcWlfXtgdLMZoB2R36y9lSOwk7AxzBOIBCIiZXICgiIAHLYrh8XMOMWFdHcerjhyVtx71vqwWaQDaQ1u1bbHvvJtSiO1vLQU6o+w73Fe6GL58/4PXtpm2ruryUeHlZBEWSr/VOt13lAMDuXra4Dth4agYPkKxVda90M5DAp8uqT5elRggRDTQCihBT3L1zHeydlKW1UxafD492r7ebolaAQA0xojX4BFVs29MToxz6LtnSQVm3yg6ORoTM5OjOoLm1324yM1jL5pCgWhW19gOmvzBETIfEHL/79WyNbRZZLkmmVtRak/b/PBp7Sxy537P44Ww+kZlDg3vC9vM5/wgc/hj0xZ7V7TdmdaCpZ/oMNrfQvtLsS/k6HqOYlQuthUK/AGc8L7OljAm1AAAAAElFTkSuQmCC'
  const pidIconDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAACY0lEQVR4nH2Wa27jMAyEv6GM3v+KCyz2DGkacfaHnrbTGAUqKRaHM3xZf//9sRSgQKivhQjAtMdImP6HDHY/l3Hbm+0cPNbNjHF/T5ID1gVf1iCY0IC1bTj9PpcSQhjUDnW50vYxvGB46x18fwS/7bUZtkFYyHe/1sExJWhyYtyUlJvfXTgNleflpYkNoUARqNlTZqUZbsQ9Q9SBbZDMCEkTSVMF68x0gs29KKWoREzKtokIsr6UWRuvC/doJhbrfW0Mby4tWWmg5QCET+ERUQ6iHLfIoB7jCWS29Z5kb24aIgqlHNjm5+ebzMrz+ZAz+Xl9yzZSKKJ0bzXNxPB/Z3lmPPZcHBBHOVoGZ2JMRMGZIGFD9nuShM6Ot3JyTpm5gM7zC+tmSz1/RNbK8/kgbZ7PhzIrGmD93VOMFxu/lfku+chQcWLRnRgA478HmHSK1mR8Ah0wV8n5/Kh1P1Dsp4PXWusXxu8k95R81aWHMfeo7awvZXhSZsR4JdCHzN7WGqUzkyeIUmbcJRFRJvjKkr63FTubz7V8l7xmnSxK+SLiQFGIcvg4viwNdS51IfloLbK3Py3DUudmgzpTG6u3TYlak4gkok2yKIVSDq9KUc+fbFzFHDQbY7ix/yD5eF6v6lpr7+FD2l5imWTmiAfekqsxHhKKE/shsy6MwcgL6FWrnUmEuttJZoI76NbdR68/Zvy0T6WenS1dJ2h/Yb2/DbuaSU13iPbhoAE4cbeWeRn+rTa2TnaT/FZizaD6B0DfwW0abx8Vdq90M4x5TphTifUyu8Rb0uoCt0G2fhuFoTZ/keT/qR93x5XfGqoAAAAASUVORK5CYII='
  const weroIconDataUrl =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAUAB4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9HZJo4SgkkRC7bFDMBuPoM9TwePaq76vYxmINe2ymUosYM6DeW+6BzyWwcY644rgf2hPhrqnxS+Gtzpnh69t9L8UWl1b6jo+oXOfLtrqJwQxwCcFDIpwP4q+V9R/4J9+K/slhZJr2l6tZQ3UlgovJPLmttMjWKKwljkMEhE8Maygqu3mQFZBg5/B8LhcNWhzVa3I+1v6/4c9+c5RdlG59yvrFhHBNO19arDC2yWQzoFjbOMMc4Bz2NXK+EdN/YV8aaHqF5qE6+EPF8IvjdLoOrvJDZamjPfc3xSImWeP7VFIkzA/dZMDarV9hfCXwbefDz4YeFPDGoaidXvtH0y3sZr45/fOiBSw3c44wM84AzzU4vDYejFOjV5/lb9f6vpswhOUnqrHWUUUV5hsFFFFAH//Z'
  const bankIconDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAIAAAAVyRqTAAACNElEQVR4nNXVP2sUQRQA8PdmZmdndu/IEskRIfGUXIoDQcHCPyBqpeAnELH1E+gHsBW0NGIdEMTKSiSFX8AmhVVEz+RiwuViLvH2bndn3rOwEbk9FySFU8/83mPmvTfYaF+C41nimNzjpVWl+AIQEAAYABEAgIiZ/40WCJ7gKCXHJIVAAu+JAWKrQo3eT+On0QJxmPnYyBvn4vMtfaYRh0YfjsTHz/m7D7tfd9OZWghMZXwpLRDSzF1c1vdvmvaCqcdBzVodmyiuSzOz019+urrx4k0nsqLMnkwLhDSnC8vho7uBYDdIiYhyYsOU+TwajxpWPX541hh88nIjqYd+Ej+5QhhQIt+7pq10mcNQi1ALo9FoYa2KjEIhYOQe3GktzttxQb/etlLWRGy0YBA7B84z5t4VHjKfayd/5KMoUHlRuKIw9VqShNv7eQiK4c/ESy5E4Lhwz9/H7VZ7MDiUQiophUBtTWStYGg2l6IoWn31+lPnMNYBTarEyTQzB1JubvU3N/dv3b7ebi1RwaZW7+3vdbd2XZH7YFYnJwZD9B6UnGiUVwgCgneFc997vXxhHoVKR0cH/f7J+eTylasrz1berq3Nzc6FOihrHpwynpABAMbZuHm6aW14anExSZLhcChVsL6+3u1+U0qxp7Ljf2/0yNrtrS4Rj9M8jqMvnU5/rx/XajoIpriVsgYARETELMuISOtQKUkVhkil8cTMzKy1RkQi8t5XOVWJ/j1A9f3/51fwE6GhAOnw1nEcAAAAAElFTkSuQmCC'

  const openHorizonBankHost = 'https://eudi-ts12-issuer-bank-provider.serveousercontent.com'
  const openHorizonBankIssuerId = '7cc028a3-8ce2-432a-bf19-5621068586df'
  const weroVct = `${openHorizonBankHost}/api/vct/${openHorizonBankIssuerId}/openid4vc:credential:WeroSca`
  const bankAccountVct = `${openHorizonBankHost}/api/vct/${openHorizonBankIssuerId}/openid4vc:credential:BankAccountSca`

  const openHorizonBankClaims = {
    account_holder_name: 'Erika Mustermann',
    account_holder_id: '1234567890',
    account_id: 'DE22123456781234567890',
    email: 'erika.mustermann@email.com',
    currency: 'EUR',
    scheme: 'Wero',
  }

  const eudiPidClaims = {
    family_name: 'Mustermann',
    given_name: 'Erika',
    birthdate: '1964-08-12',
    place_of_birth: {
      country: 'NL',
      region: 'Utrecht',
      locality: 'Utrecht',
    },
    nationalities: ['NL'],
    address: {
      formatted: 'Rietveld 1, 90210 Utrecht',
      street_address: 'Rietveld',
      house_number: '1',
      locality: 'Utrecht',
      region: 'Utrecht',
      postal_code: '90210',
      country: 'NL',
    },
    date_of_expiry: '2030-08-12',
    issuing_authority: 'Rijksdienst voor Identiteitsgegevens',
    issuing_country: 'NL',
    date_of_issuance: '2020-08-12',
  } satisfies SdJwtDcClaims

  const mdocDriversLicenseNamespaces = {
    'org.iso.18013.5.1': {
      given_name: 'Erika',
      family_name: 'Mustermann',
      birth_date: '1964-08-12',
      age_over_18: true,
      document_number: 'Z021AB37X13',
      portrait: null,
      signature_usual_mark: null,
      resident_postal_code: '90210',
      un_distinguishing_sign: 'D',
      issuing_authority: 'Bundesrepublik Deutschland',
      issue_date: '2024-01-15',
      expiry_date: '2039-01-14',
      issuing_country: 'NL',
      driving_privileges: null,
    },
  }

  const mdocDisplayClaims = [
    {
      path: ['org.iso.18013.5.1', 'given_name'],
      displayName: 'Given Name',
    },
    {
      path: ['org.iso.18013.5.1', 'family_name'],
      displayName: 'Family Name',
    },
    {
      path: ['org.iso.18013.5.1', 'birth_date'],
      displayName: 'Birth Date',
    },
    {
      path: ['org.iso.18013.5.1', 'age_over_18'],
      displayName: 'Age Over 18',
    },
    {
      path: ['org.iso.18013.5.1', 'document_number'],
      displayName: 'Document Number',
    },
    {
      path: ['org.iso.18013.5.1', 'issue_date'],
      displayName: 'Issue Date',
    },
    {
      path: ['org.iso.18013.5.1', 'expiry_date'],
      displayName: 'Expiry Date',
    },
    {
      path: ['org.iso.18013.5.1', 'issuing_country'],
      displayName: 'Issuing Country',
    },
    {
      path: ['org.iso.18013.5.1', 'issuing_authority'],
      displayName: 'Issuing Authority',
    },
    {
      path: ['org.iso.18013.5.1', 'resident_postal_code'],
      displayName: 'Postal Code',
    },
    {
      path: ['org.iso.18013.5.1', 'driving_privileges'],
      displayName: 'Driving Privileges',
    },
  ]

  const pidDisplayClaims = [
    {
      path: ['family_name'],
      displayName: 'Family Name',
    },
    {
      path: ['given_name'],
      displayName: 'Given Name',
    },
    {
      path: ['birthdate'],
      displayName: 'Date of Birth',
    },
    {
      path: ['place_of_birth', 'locality'],
      displayName: 'Birth City',
    },
    {
      path: ['nationalities'],
      displayName: 'Nationality',
    },
    {
      path: ['address', 'locality'],
      displayName: 'Resident City',
    },
  ]

  const accountDisplayClaims = [
    {
      path: ['account_holder_name'],
      displayName: 'Account Holder',
    },
    {
      path: ['account_holder_id'],
      displayName: 'Account Holder ID',
    },
    {
      path: ['account_id'],
      displayName: 'Account ID',
    },
    {
      path: ['email'],
      displayName: 'Email',
    },
    {
      path: ['currency'],
      displayName: 'Currency',
    },
  ]

  const mdocFields = [
    {
      path: ['org.iso.18013.5.1', 'given_name'],
      display_name: 'Given Name',
    },
    {
      path: ['org.iso.18013.5.1', 'family_name'],
      display_name: 'Family Name',
    },
    {
      path: ['org.iso.18013.5.1', 'birth_date'],
      display_name: 'Birth Date',
    },
    {
      path: ['org.iso.18013.5.1', 'age_over_18'],
      display_name: 'Age Over 18',
    },
    {
      path: ['org.iso.18013.5.1', 'document_number'],
      display_name: 'Document Number',
    },
    {
      path: ['org.iso.18013.5.1', 'issue_date'],
      display_name: 'Issue Date',
    },
    {
      path: ['org.iso.18013.5.1', 'expiry_date'],
      display_name: 'Expiry Date',
    },
    {
      path: ['org.iso.18013.5.1', 'issuing_country'],
      display_name: 'Issuing Country',
    },
    {
      path: ['org.iso.18013.5.1', 'issuing_authority'],
      display_name: 'Issuing Authority',
    },
    {
      path: ['org.iso.18013.5.1', 'resident_postal_code'],
      display_name: 'Postal Code',
    },
    {
      path: ['org.iso.18013.5.1', 'driving_privileges'],
      display_name: 'Driving Privileges',
    },
  ]

  const pidFields = [
    {
      path: ['family_name'],
      display_name: 'Family Name',
    },
    {
      path: ['given_name'],
      display_name: 'Given Name',
    },
    {
      path: ['birthdate'],
      display_name: 'Date of Birth',
    },
    {
      path: ['place_of_birth', 'locality'],
      display_name: 'Birth City',
    },
    {
      path: ['nationalities'],
      display_name: 'Nationality',
    },
    {
      path: ['address', 'locality'],
      display_name: 'Resident City',
    },
  ]

  const accountFields = [
    {
      path: ['account_holder_name'],
      display_name: 'Account Holder',
    },
    {
      path: ['account_holder_id'],
      display_name: 'Account Holder ID',
    },
    {
      path: ['account_id'],
      display_name: 'Account ID',
    },
    {
      path: ['email'],
      display_name: 'Email',
    },
    {
      path: ['currency'],
      display_name: 'Currency',
    },
  ]

  const ts12GenericTransactionDataTypes = [
    {
      type: 'urn:eudi:sca:generic:1',
      subtype: 'login',
      claims: [
        {
          path: ['payload', 'service'],
          display: [{ locale: 'en', label: 'Log in to service' }],
        },
        {
          path: ['payload', 'ip_address'],
          display: [{ locale: 'en', label: 'Requesting from' }],
        },
      ],
      ui_labels: [
        {
          key: 'transaction_title',
          values: [{ locale: 'en', value: 'Login to your Account' }],
        },
        {
          key: 'affirmative_action_label',
          values: [{ locale: 'en', value: 'Login' }],
        },
        {
          key: 'denial_action_label',
          values: [{ locale: 'en', value: 'Cancel' }],
        },
        {
          key: 'security_hint',
          values: [
            {
              locale: 'en',
              value:
                'We will never ask for your password, PIN, or OTP. If you received a request for these, do not approve.',
            },
          ],
        },
      ],
      schema: {},
    },
    {
      type: 'urn:eudi:sca:generic:1',
      subtype: 'increase_spending_limit',
      claims: [
        {
          path: ['payload', 'old_spending_limit'],
          display: [{ locale: 'en', label: 'Old Spending Limit' }],
        },
        {
          path: ['payload', 'new_spending_limit'],
          display: [{ locale: 'en', label: 'New Spending Limit' }],
        },
      ],
      ui_labels: [
        {
          key: 'transaction_title',
          values: [{ locale: 'en', value: 'Increase Spending Limit' }],
        },
        {
          key: 'affirmative_action_label',
          values: [{ locale: 'en', value: 'Confirm' }],
        },
        {
          key: 'denial_action_label',
          values: [{ locale: 'en', value: 'Reject' }],
        },
        {
          key: 'security_hint',
          values: [
            {
              locale: 'en',
              value:
                'If someone asked you to increase this limit, it may be a scam. We will never ask you to move money.',
            },
          ],
        },
      ],
      schema: {},
    },
  ]

  const ts12PaymentTransactionDataTypes = [
    {
      type: 'urn:eudi:sca:payment:1',
      claims: [
        {
          path: ['payload', 'date_time'],
          display: [{ locale: 'en', label: 'Date & Time' }],
        },
        {
          path: ['payload', 'payee', 'name'],
          display: [{ locale: 'en', label: 'Payee Name' }],
        },
        {
          path: ['payload', 'payee', 'id'],
          display: [{ locale: 'en', label: 'Payee ID' }],
        },
        {
          path: ['payload', 'payee', 'logo'],
          display: [{ locale: 'en', label: 'Payee Logo' }],
        },
        {
          path: ['payload', 'payee', 'website'],
          display: [{ locale: 'en', label: 'Payee Website' }],
        },
        {
          path: ['payload', 'pisp', 'legal_name'],
          display: [{ locale: 'en', label: 'PISP Legal Name' }],
        },
        {
          path: ['payload', 'pisp', 'brand_name'],
          display: [{ locale: 'en', label: 'PISP Brand Name' }],
        },
        {
          path: ['payload', 'pisp', 'domain_name'],
          display: [{ locale: 'en', label: 'PISP Domain Name' }],
        },
        {
          path: ['payload', 'execution_date'],
          display: [{ locale: 'en', label: 'Execution Date' }],
        },
        {
          path: ['payload', 'currency'],
          display: [{ locale: 'en', label: 'Currency' }],
        },
        {
          path: ['payload', 'amount'],
          display: [{ locale: 'en', label: 'Amount' }],
        },
        {
          path: ['payload', 'amount_estimated'],
          display: [{ locale: 'en', label: 'Estimated Amount' }],
        },
        {
          path: ['payload', 'amount_earmarked'],
          display: [{ locale: 'en', label: 'Earmarked Amount' }],
        },
        {
          path: ['payload', 'sct_inst'],
          display: [{ locale: 'en', label: 'Instant Payment' }],
        },
        {
          path: ['payload', 'recurrence', 'start_date'],
          display: [{ locale: 'en', label: 'Start Date' }],
        },
        {
          path: ['payload', 'recurrence', 'end_date'],
          display: [{ locale: 'en', label: 'End Date' }],
        },
        {
          path: ['payload', 'recurrence', 'number'],
          display: [{ locale: 'en', label: 'Number of Payments' }],
        },
        {
          path: ['payload', 'recurrence', 'frequency'],
          display: [{ locale: 'en', label: 'Frequency' }],
        },
        {
          path: ['payload', 'recurrence', 'mit_options', 'amount_variable'],
          display: [{ locale: 'en', label: 'Variable Amount' }],
        },
        {
          path: ['payload', 'recurrence', 'mit_options', 'min_amount'],
          display: [{ locale: 'en', label: 'Min Amount' }],
        },
        {
          path: ['payload', 'recurrence', 'mit_options', 'max_amount'],
          display: [{ locale: 'en', label: 'Max Amount' }],
        },
        {
          path: ['payload', 'recurrence', 'mit_options', 'total_amount'],
          display: [{ locale: 'en', label: 'Total Amount' }],
        },
        {
          path: ['payload', 'recurrence', 'mit_options', 'initial_amount'],
          display: [{ locale: 'en', label: 'Initial Amount' }],
        },
        {
          path: ['payload', 'recurrence', 'mit_options', 'initial_amount_number'],
          display: [{ locale: 'en', label: 'Number of Initial Payments' }],
        },
        {
          path: ['payload', 'recurrence', 'mit_options', 'apr'],
          display: [{ locale: 'en', label: 'APR' }],
        },
      ],
      ui_labels: [
        {
          key: 'transaction_title',
          values: [{ locale: 'en', value: 'Confirm Payment' }],
        },
        {
          key: 'affirmative_action_label',
          values: [{ locale: 'en', value: 'Pay' }],
        },
        {
          key: 'denial_action_label',
          values: [{ locale: 'en', value: 'Reject' }],
        },
      ],
      schema: {},
    },
  ]

  const legacyCredentials: CredentialItem[] = [
    {
      id: '1',
      display: {
        title: 'Drivers License',
        subtitle: 'Issued by Utopia',
        claims: mdocDisplayClaims,
        iconDataUrl: mdlIconDataUrl,
      },
      credential: {
        doctype: 'org.iso.18013.5.1.mDL',
        format: 'mso_mdoc',
        namespaces: mdocDriversLicenseNamespaces,
      },
    },
    {
      id: 'mdl-bdr',
      display: {
        title: 'Drivers License',
        subtitle: 'Issued by Bundesdruckerei',
        claims: mdocDisplayClaims,
        iconDataUrl: mdlIconDataUrl,
      },
      credential: {
        doctype: 'org.iso.18013.5.1.mDL',
        format: 'mso_mdoc',
        namespaces: mdocDriversLicenseNamespaces,
      },
    },
    {
      id: '2',
      display: {
        title: 'EUDI PID',
        subtitle: 'Issued by Utopia',
        claims: pidDisplayClaims,
        iconDataUrl: pidIconDataUrl,
      },
      credential: {
        vct: 'urn:eudi:pid:1',
        format: 'dc+sd-jwt',
        claims: eudiPidClaims,
      },
    },
    {
      id: 'pid-bdr',
      display: {
        title: 'EUDI PID',
        subtitle: 'Issued by Bundesdruckerei',
        claims: pidDisplayClaims,
        iconDataUrl: pidIconDataUrl,
      },
      credential: {
        vct: 'urn:eudi:pid:1',
        format: 'dc+sd-jwt',
        claims: eudiPidClaims,
      },
    },
    {
      id: '3',
      display: {
        title: 'Wero',
        subtitle: 'Issued by Open Horizon Bank',
        claims: accountDisplayClaims,
        iconDataUrl: weroIconDataUrl,
      },
      credential: {
        vct: weroVct,
        format: 'dc+sd-jwt',
        claims: openHorizonBankClaims,
      },
    },
    {
      id: '4',
      display: {
        title: 'Bank Account',
        subtitle: 'Issued by Open Horizon Bank',
        claims: accountDisplayClaims,
        iconDataUrl: bankIconDataUrl,
      },
      credential: {
        vct: bankAccountVct,
        format: 'dc+sd-jwt',
        claims: openHorizonBankClaims,
      },
    },
  ]

  const aptitudeConfig: AptitudeConsortiumConfigInput = {
    default_id_prefix: 'cred-',
    openid4vp: {
      enabled: true,
      allow_dcql: true,
      allow_transaction_data: true,
      allow_signed_requests: true,
      allow_response_mode_jwt: true,
    },
    dcql: {
      credential_set_option_mode: 'first_satisfiable_only',
      optional_credential_sets_mode: 'prefer_present',
    },
    credentials: [
      {
        id: 'mdoc-1',
        format: 'mso_mdoc',
        title: 'Drivers License',
        subtitle: 'Issued by Utopia',
        icon: mdlIconDataUrl,
        doctype: 'org.iso.18013.5.1.mDL',
        fields: mdocFields,
        claims: mdocDriversLicenseNamespaces,
      },
      {
        id: 'mdoc-bdr-1',
        format: 'mso_mdoc',
        title: 'Drivers License',
        subtitle: 'Issued by Bundesdruckerei',
        icon: mdlIconDataUrl,
        doctype: 'org.iso.18013.5.1.mDL',
        fields: mdocFields,
        claims: mdocDriversLicenseNamespaces,
      },
      {
        id: 'pid-1',
        format: 'dc+sd-jwt',
        title: 'EUDI PID',
        subtitle: 'Issued by Utopia',
        icon: pidIconDataUrl,
        vcts: ['urn:eudi:pid:1'],
        fields: pidFields,
        claims: eudiPidClaims,
      },
      {
        id: 'pid-bdr-1',
        format: 'dc+sd-jwt',
        title: 'EUDI PID',
        subtitle: 'Issued by Bundesdruckerei',
        icon: pidIconDataUrl,
        vcts: ['urn:eudi:pid:1'],
        fields: pidFields,
        claims: eudiPidClaims,
      },
      {
        id: 'wero-1',
        format: 'dc+sd-jwt',
        title: 'Wero',
        subtitle: 'Issued by Open Horizon Bank',
        icon: weroIconDataUrl,
        vcts: [weroVct],
        fields: accountFields,
        transaction_data_types: ts12PaymentTransactionDataTypes,
        claims: openHorizonBankClaims,
      },
      {
        id: 'bank-account-1',
        format: 'dc+sd-jwt',
        title: 'Bank Account',
        subtitle: 'Issued by Open Horizon Bank',
        icon: bankIconDataUrl,
        vcts: [bankAccountVct],
        fields: accountFields,
        transaction_data_types: ts12GenericTransactionDataTypes,
        claims: openHorizonBankClaims,
      },
    ],
  }

  const register = (matcher: 'ubique' | 'cmwallet' | 'aptitude-consortium') => {
    if (matcher === 'aptitude-consortium') {
      const normalized = normalizeAptitudeConsortiumConfig(aptitudeConfig, { debug: true })
      const credentialsBytes = encodeAptitudeConsortiumConfig(normalized)
      const decoded = new TextDecoder().decode(credentialsBytes)
      console.log('Aptitude matcher payload (json)', decoded)
      return registerAptitude({ aptitudeConsortiumConfig: normalized })
        .then(() => console.log('success', matcher))
        .catch((error) => console.error('error', error))
    }

    const registerFn = matcher === 'ubique' ? registerUbique : registerCmWallet
    return matcher === 'ubique'
      ? registerFn({ credentials: legacyCredentials, debug: true })
      : registerFn({ credentials: legacyCredentials })
      .then(() => console.log('success', matcher))
      .catch((error) => console.error('error', error))
  }

  const registerIssuance = () => {
    const creationOptions = encodeIssuanceCreationOptions({
      display: {
        title: 'CMWallet',
        subtitle: 'Save your document to CMWallet',
        iconDataUrl: mdlIconDataUrl,
      },
    })
    return registerCmWalletIssuance({ creationOptions })
      .then(() => console.log('success', 'cmwallet-issuance'))
      .catch((error) => console.error('error', error))
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Group name="Register Credentials">
          <Button title="Ubique Matcher" onPress={() => register('ubique')} />
          <View style={{ height: 20 }} />
          <Button title="CMWallet Matcher" onPress={() => register('cmwallet')} />
          <View style={{ height: 20 }} />
          <Button title="Aptitude Consortium Matcher" onPress={() => register('aptitude-consortium')} />
          <View style={{ height: 20 }} />
          <Button title="CMWallet Issuance (VCI)" onPress={registerIssuance} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  )
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  )
}

const styles = {
  groupHeader: {
    fontSize: 20,
    marginBottom: 20,
  },
  group: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#eee',
  },
}
