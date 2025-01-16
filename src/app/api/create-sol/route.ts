import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import { PumpFunSDK } from "pumpdotfun-sdk";
import { AnchorProvider } from "@coral-xyz/anchor";
import { getFile, upload } from "@/app/actions";

// Reduced timeouts to work within Vercel limits
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second
const TRANSACTION_TIMEOUT = 25000; // 25 seconds
const SDK_TIMEOUT = 20000; // 20 seconds

// Add timeout wrapper
const withTimeout = async (promise: Promise<any>, timeoutMs: number, operation: string) => {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
};

async function getBlockhashWithRetry(connection: Connection, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await withTimeout(
        connection.getLatestBlockhash('finalized'),
        5000,
        'getLatestBlockhash'
      );
      return { 
        blockhash: result.blockhash, 
        lastValidBlockHeight: result.lastValidBlockHeight + 150
      };
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  throw new Error('Failed to get blockhash after retries');
}

export async function POST(req: NextRequest) {
  let filePath: string | null = null;
  let connection: Connection | null = null;

  try {
    console.log("Starting token creation process...");
    
    const data = await req.formData();
    
    // Upload file with timeout
    const uploadResult = await withTimeout(
      upload(data),
      10000,
      'File upload'
    );

    const walletDataRaw = data.get("walletData");
    if (!walletDataRaw) throw new Error("No wallet data provided");

    const walletData = JSON.parse(walletDataRaw as string);

    // Establish connection with timeout
    let retryCount = 0;
    while (!connection && retryCount < MAX_RETRIES) {
      try {
        const conn = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL!, {
          commitment: 'finalized',
          confirmTransactionInitialTimeout: TRANSACTION_TIMEOUT,
        });
        
        // Test connection
        await withTimeout(
          conn.getLatestBlockhash(),
          5000,
          'Connection test'
        );
        
        connection = conn;
        console.log("Connection established");
      } catch (e) {
        retryCount++;
        if (retryCount === MAX_RETRIES) throw e;
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
      }
    }
    if (!connection) throw new Error("Failed to establish connection");

    const keypair = Keypair.fromSecretKey(Uint8Array.from(walletData.keypair));
    const mint = Keypair.fromSecretKey(Uint8Array.from(walletData.mint));

    // Check balance with timeout
    const balance = await withTimeout(
      connection.getBalance(keypair.publicKey),
      5000,
      'Balance check'
    );

    if (balance < 0.0001 * LAMPORTS_PER_SOL) {
      throw new Error(`Insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    }

    const walletInstance = {
      publicKey: keypair.publicKey,
      signTransaction: async (tx: Transaction) => {
        const { blockhash, lastValidBlockHeight } = await getBlockhashWithRetry(connection!);
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.partialSign(keypair);
        return tx;
      },
      signAllTransactions: async (txs: Transaction[]) => {
        const { blockhash, lastValidBlockHeight } = await getBlockhashWithRetry(connection!);
        return txs.map((t) => {
          t.recentBlockhash = blockhash;
          t.lastValidBlockHeight = lastValidBlockHeight;
          t.partialSign(keypair);
          return t;
        });
      },
    };

    const provider = new AnchorProvider(connection, walletInstance as any, {
      commitment: 'finalized',
      preflightCommitment: 'finalized',
    });

    const sdk = new PumpFunSDK(provider);

    const ipfsData = await withTimeout(
      getFile(uploadResult.hash, "application/octet-stream"),
      10000,
      'IPFS file fetch'
    );
    
    const fileBlob = new Blob([JSON.stringify(ipfsData)], {
      type: "application/octet-stream",
    });

    const tokenMetadata = {
      name: data.get("tokenName") as string,
      symbol: data.get("tokenSymbol") as string,
      description: data.get("tokenDescription") as string,
      file: await fileBlob,
      properties: {
        links: {
          twitter: data.get("twitterLink") || undefined,
          website: data.get("websiteLink") || undefined,
          telegram: data.get("telegramLink") || undefined,
        },
      },
    };

    // Create token with timeout
    let createResults;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        createResults = await withTimeout(
          sdk.createAndBuy(
            keypair,
            mint,
            tokenMetadata,
            BigInt(0.0001 * LAMPORTS_PER_SOL)
          ),
          SDK_TIMEOUT,
          'Token creation'
        );
        
        if (createResults.success) {
          console.log("Token creation successful on attempt", i + 1);
          break;
        }
      } catch (error) {
        console.error(`Token creation attempt ${i + 1} failed:`, error);
        if (i === MAX_RETRIES - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }

    if (!createResults?.success) {
      throw new Error("Token creation failed after all retries");
    }

    const tokenUrl = `https://pump.fun/${mint.publicKey.toBase58()}`;
    return NextResponse.json({ success: true, tokenUrl });

  } catch (error) {
    console.error("Detailed error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create token",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: error instanceof Error && error.message.includes('timed out') ? 504 : 500 }
    );
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error("Error cleaning up temporary file:", error);
      }
    }
  }
}