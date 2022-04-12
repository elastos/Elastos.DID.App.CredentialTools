export type BuiltInTypeDescription = {
  context: string;
  type: string;
  description: string;
}

/**
 * List of hardcoded descriptions that are used in case some credential types are lacking a proper
 * description. This works for both https contexts, but also for DID ones if needed, in case some
 * contexts become popular but their authors don't manage them.
 */
export const builtInDescriptions: BuiltInTypeDescription[] = [
  // Elastos - bases
  {
    context: "https://www.w3.org/2018/credentials/v1", type: "VerifiableCredential",
    description: "This is the base type for all verifiable credentials. All credentials have to implement at least this type, but there are no specific properties for it."
  },
  {
    context: "https://ns.elastos.org/credentials/displayable/v1", type: "DisplayableCredential",
    description: "This custom elastos foundation type is used as a standardized way to better display credentials using an icon, a title and a description. When a credential implements those properties, it will be displayed in a better way in identity wallets."
  },
  {
    context: "https://ns.elastos.org/credentials/context/v1", type: "ContextDefCredential",
    description: "This is a special credential, used by developers (and by this toolbox) to store newly created credential types on the identity chain. Standard user credentials usually don't use this type."
  },
  {
    context: "https://ns.elastos.org/credentials/v1", type: "SelfProclaimedCredential",
    description: "This type is usually used to inform that a credential was self-created, meaning that a user has created the credential for himself, probably in his identity wallet (eg: name, birth date...)."
  },
  {
    context: "https://ns.elastos.org/credentials/v1", type: "SensitiveCredential",
    description: "This sensitive credential type is useful to inform that user should pay attention - meaning, be careful to not share it with everyone - to the implementing credential. For instance, social security number, credit card number... Identity wallets usually show a specific visual indicator for such credentials."
  },

  // Elastos - social
  {
    context: "https://ns.elastos.org/credentials/social/twitter/v1", type: "TwitterCredential",
    description: "Type for Twitter (twitter.com) accounts. The twitter field should be a @identifier."
  },
  {
    context: "https://ns.elastos.org/credentials/social/tumblr/v1", type: "TumblrCredential",
    description: "Type for Tumblr (tumblr.com) accounts."
  },
  {
    context: "https://ns.elastos.org/credentials/social/wechat/v1", type: "WechatCredential",
    description: "Type for Wechat accounts (messaging application)."
  },
  {
    context: "https://ns.elastos.org/credentials/social/facebook/v1", type: "FacebookCredential",
    description: "Type for Facebook (facebook.com) accounts."
  },
  {
    context: "https://ns.elastos.org/credentials/social/telegram/v1", type: "TelegramCredential",
    description: "Type for Telegram accounts (messaging application)."
  },
  {
    context: "https://ns.elastos.org/credentials/social/weibo/v1", type: "WeiboCredential",
    description: "Type for Weibo accounts (\"Chinese Twitter\")."
  },
  {
    context: "https://ns.elastos.org/credentials/social/instagram/v1", type: "InstagramCredential",
    description: "Type for Instagram (instagram.com) accounts."
  },
  {
    context: "https://ns.elastos.org/credentials/social/linkedin/v1", type: "LinkedinCredential",
    description: "Type for LinkedIn (linkedin.com) accounts."
  },
  {
    context: "https://ns.elastos.org/credentials/social/qq/v1", type: "QQCredential",
    description: "Type for QQ accounts."
  },

  // Elastos - profile
  {
    context: "https://ns.elastos.org/credentials/profile/v1",
    type: "ProfileCredential",
    description: "This credential context contains several properties such as name or gender, that can be used independently in credentials to describe a user, a person."
  },

  // Elastos - Profile
  {
    context: "https://ns.elastos.org/credentials/profile/name/v1", type: "NameCredential",
    description: "Standard type that describes a person's name. A name can be described using different fields depending on the context, such as givenName, or nickName."
  },
  {
    context: "https://ns.elastos.org/credentials/profile/nationality/v1", type: "NationalityCredential",
    description: "Standard type that describes a person's nationality. The nationality format is broad, please refer to schema.org."
  },
  {
    context: "https://ns.elastos.org/credentials/profile/gender/v1", type: "GenderCredential",
    description: "Standard type that describes a person's genger. Usually, male or female."
  },
  {
    context: "https://ns.elastos.org/credentials/profile/url/v1", type: "URLCredential",
    description: "Standard type that describes a URL. This can represent a personal or a business website."
  },
  {
    context: "https://ns.elastos.org/credentials/profile/description/v1", type: "DescriptionCredential",
    description: "Standard type that gives a brief introduction about a person. For instance, a short biography."
  },
  {
    context: "https://ns.elastos.org/credentials/profile/avatar/v1", type: "AvatarCredential",
    description: "Standard type that represents a person's avatar, i.e. a small visual representation picture. Refer to schema.org for all possible fields an 'image' can contain. Usually, 'contentUrl' is the most important field."
  },
  {
    context: "https://ns.elastos.org/credentials/profile/email/v1", type: "EmailCredential",
    description: "Standard type that describes emails. The email field can be a single email, or an array of emails."
  },

  // Elastos - wallet
  {
    context: "https://ns.elastos.org/credentials/wallet/v1", type: "WalletCredential",
    description: "This credential type allows creating credentials with wallet addresses. Most fields are optional and can be used to describe the wallet blockchain, address, address type, balance, public key, etc."
  },
];

/**
 * For convenience, some credential types (essentially https ones) have hardcoded descriptions
 * for now.
 */
export const getBuiltInTypeDescription = (context: string, shortType: string): string => {
  let builtInDescription = builtInDescriptions.find(bid => bid.context === context && bid.type === shortType);
  if (!builtInDescription)
    return null;

  return builtInDescription.description;
}