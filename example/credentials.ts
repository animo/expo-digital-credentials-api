import type { DcApiCredential } from '@animo-id/expo-digital-credentials-api'

/**
 * The wallet's own credential storage, standing in for a real one.
 *
 * The library keeps no copy of the credentials — it hands the OS only what it matches on — so both
 * halves of the app read them from here: the app to register them, and the request UI to work out
 * which of them can answer a request. A real wallet puts its database in the app group container so
 * the provider extension can open it too; see `getSharedContainerPath()`.
 */
const icon =
  'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEASABIAAD//gATQ3JlYXRlZCB3aXRoIEdJTVD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wgARCABLAGQDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAWAQEBAQAAAAAAAAAAAAAAAAAABgj/2gAMAwEAAhADEAAAAZzC6pAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAABw/9oACAEBAAEFAgL/xAAUEQEAAAAAAAAAAAAAAAAAAABw/9oACAEDAQE/AQL/xAAUEQEAAAAAAAAAAAAAAAAAAABw/9oACAECAQE/AQL/xAAUEAEAAAAAAAAAAAAAAAAAAABw/9oACAEBAAY/AgL/xAAUEAEAAAAAAAAAAAAAAAAAAABw/9oACAEBAAE/IQL/2gAMAwEAAgADAAAAEP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/8QAFBEBAAAAAAAAAAAAAAAAAAAAcP/aAAgBAwEBPxAC/8QAFBEBAAAAAAAAAAAAAAAAAAAAcP/aAAgBAgEBPxAC/8QAFBABAAAAAAAAAAAAAAAAAAAAcP/aAAgBAQABPxAC/9k='

const credentials: DcApiCredential[] = [
  {
    id: '1',
    display: {
      title: 'Drivers License',
      subtitle: 'Issued by Utopia',
      claims: [{ path: ['org.iso.18013.5.1', 'family_name'], displayName: 'Family Name' }],
      iconDataUrl: icon,
    },
    credential: {
      doctype: 'org.iso.18013.5.1.mDL',
      format: 'mso_mdoc',
      namespaces: {
        'org.iso.18013.5.1': {
          family_name: 'Glastra',
          given_name: 'Timo',
        },
      },
    },
  },
  {
    id: '2',
    display: {
      title: 'PID (SD-JWT)',
      subtitle: 'Issued by Utopia',
      claims: [
        { path: ['first_name'], displayName: 'First Name' },
        { path: ['address', 'city'], displayName: 'Resident City' },
      ],
      iconDataUrl: icon,
    },
    credential: {
      vct: 'eu.europa.ec.eudi.pid.1',
      format: 'dc+sd-jwt',
      claims: {
        first_name: 'Timo',
        address: {
          city: 'Somewhere',
        },
      },
    },
  },
  {
    id: '3',
    display: {
      title: 'PID (mdoc)',
      subtitle: 'Issued by Utopia',
      claims: [
        { path: ['eu.europa.ec.eudi.pid.1', 'given_name'], displayName: 'First Name' },
        { path: ['eu.europa.ec.eudi.pid.1', 'resident_city'], displayName: 'Resident City' },
      ],
      iconDataUrl: icon,
    },
    credential: {
      doctype: 'eu.europa.ec.eudi.pid.1',
      format: 'mso_mdoc',
      namespaces: {
        'eu.europa.ec.eudi.pid.1': {
          family_name: 'Glastra',
          given_name: 'Timo',
          birth_date: '1990-01-01',
          age_over_18: true,
          resident_city: 'Somewhere',
        },
      },
    },
  },
]

export { credentials }
