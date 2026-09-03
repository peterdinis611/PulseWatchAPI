import { registerEnumType } from '@nestjs/graphql';

export enum DnsRecordType {
  A = 'A',
  AAAA = 'AAAA',
  CNAME = 'CNAME',
  MX = 'MX',
  TXT = 'TXT',
  NS = 'NS',
}

registerEnumType(DnsRecordType, {
  name: 'DnsRecordType',
  description: 'DNS record to resolve',
});

export const DNS_RECORD_TYPES = Object.values(DnsRecordType);
