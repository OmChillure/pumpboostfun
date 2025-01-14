import { Wallet } from '../models/Wallet';
import { Token } from '../models/Token';
import { TokenMetadata } from '../models/TokenMetadata';
import type { WalletInfo, TokenData } from '../lib/types';

export async function saveWalletAndToken(walletInfo: WalletInfo, tokenData: TokenData) {
  try {
    let tokenMetadata = await TokenMetadata.findOne({ name: tokenData.tokenName });
    
    if (!tokenMetadata) {
      tokenMetadata = await TokenMetadata.create({
        name: tokenData.tokenName,
        symbol: tokenData.tokenSymbol,
        description: tokenData.tokenDesc,
        url: tokenData.tokenUrl,
        imageUrl: tokenData.imageUrl,
        socialLinks: {
          twitter: tokenData.twitterLink,
          website: tokenData.websiteLink,
          telegram: tokenData.telegramLink
        }
      });
    }

    const wallet = await Wallet.findOneAndUpdate(
      { publicKey: walletInfo.publicKey },
      {
        name: walletInfo.name,
        publicKey: walletInfo.publicKey,
        balance: walletInfo.balance,
        keypair: walletInfo.keypair,
        mint: walletInfo.mint
      },
      { upsert: true, new: true }
    );

    const token = await Token.create({
      tokenMetadata: tokenMetadata._id,
      wallet: wallet._id,
      tokenUrl: walletInfo.tokenUrl
    });

    return { wallet, token, tokenMetadata };
  } catch (error) {
    console.error('Error saving wallet and token:', error);
    throw error;
  }
}

export async function getTokenByMetadata(tokenName: string) {
  const tokenMetadata = await TokenMetadata.findOne({ name: tokenName });
  if (!tokenMetadata) return null;
  
  return Token.findOne({ tokenMetadata: tokenMetadata._id })
    .sort({ createdAt: -1 })
    .populate('tokenMetadata')
    .populate('wallet');
}

export async function getAllTokenMetadata() {
  return TokenMetadata.find().sort({ createdAt: -1 });
}

export async function getWalletTokens(walletPublicKey: string) {
  const wallet = await Wallet.findOne({ publicKey: walletPublicKey });
  if (!wallet) return [];
  
  return Token.find({ wallet: wallet._id })
    .populate('tokenMetadata')
    .sort({ createdAt: -1 });
}