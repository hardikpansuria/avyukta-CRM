export type InvitationEmailData = {
  full_name: string;
  organization_name: string;
  organization_code: string;
};

type InvitationEmailDataInput = {
  fullName: string;
  organizationName: string;
  organizationCode: string;
};

export function buildInvitationEmailData({
  fullName,
  organizationName,
  organizationCode,
}: InvitationEmailDataInput): InvitationEmailData {
  return {
    full_name: fullName.trim(),
    organization_name: organizationName.trim(),
    organization_code: organizationCode.trim(),
  };
}
