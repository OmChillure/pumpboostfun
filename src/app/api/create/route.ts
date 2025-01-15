import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { PumpFunSDK } from "pumpdotfun-sdk";
import { AnchorProvider } from "@coral-xyz/anchor";
import { getFile, upload } from "@/app/actions";

export async function POST(req: NextRequest) {
  let filePath: string | null = null;
  let connection: Connection | null = null;

  try {
    console.log("Starting token creation process...");

    const data = await req.formData();
    console.log("Form data received");
    console.log("Form data keys:", Array.from(data.keys()));

    const uploadResult = await upload(data);
    console.log("File uploaded to IPFS:", uploadResult.hash);

    // const file = data.get("file") as File;
    // if (!file) throw new Error("No file provided");

    // console.log("File details:", {
    //   name: file.name,
    //   type: file.type,
    //   size: file.size,
    // });

    // const buffer = new Uint8Array(await file.arrayBuffer());
    // filePath = path.join(tmpDir, `${Date.now()}-${file.name}`);
    // fs.writeFileSync(filePath, buffer);
    // console.log("File saved to:", filePath);

    // if (!fs.existsSync(filePath)) {
    //   throw new Error("Failed to save file");
    // }

    const walletDataRaw = data.get("walletData");
    if (!walletDataRaw) throw new Error("No wallet data provided");

    const walletData = JSON.parse(walletDataRaw as string);
    console.log("Wallet data parsed successfully");

    let retryCount = 0;
    while (!connection && retryCount < 3) {
      try {
        connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL!, {
          commitment: "finalized",
          confirmTransactionInitialTimeout: 120000,
        });
        console.log("Connection established");
      } catch (e) {
        retryCount++;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (!connection) throw new Error("Failed to establish connection");

    const keypair = Keypair.fromSecretKey(Uint8Array.from(walletData.keypair));
    const mint = Keypair.fromSecretKey(Uint8Array.from(walletData.mint));
    console.log("Keypairs created");

    const balance = await connection.getBalance(keypair.publicKey);
    console.log("Main account balance:", balance / LAMPORTS_PER_SOL, "SOL");

    const mintBalance = await connection.getBalance(mint.publicKey);
    console.log("Mint account balance:", mintBalance / LAMPORTS_PER_SOL, "SOL");

    const mainAccountInfo = await connection.getAccountInfo(keypair.publicKey);
    console.log("Main account exists:", !!mainAccountInfo);

    const mintAccountInfo = await connection.getAccountInfo(mint.publicKey);
    console.log("Mint account exists:", !!mintAccountInfo);

    if (balance < 0.0001 * LAMPORTS_PER_SOL) {
      throw new Error(
        `Main account has insufficient balance: ${
          balance / LAMPORTS_PER_SOL
        } SOL`
      );
    }

    if (balance < 0.0001 * LAMPORTS_PER_SOL) {
      throw new Error(
        `Insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL`
      );
    }

    const walletInstance = {
      publicKey: keypair.publicKey,
      signTransaction: async (tx: Transaction) => {
        tx.partialSign(keypair);
        return tx;
      },
      signAllTransactions: async (txs: Transaction[]) => {
        return txs.map((t) => {
          t.partialSign(keypair);
          return t;
        });
      },
    };

    const provider = new AnchorProvider(connection, walletInstance as any, {
      commitment: "finalized",
      preflightCommitment: "finalized",
    });
    console.log("Provider created");

    const sdk = new PumpFunSDK(provider);
    console.log("SDK initialized");

    const ipfsData = await getFile(uploadResult.hash,"application/octet-stream");
    const fileBlob = new Blob([JSON.stringify(ipfsData)], {type: "application/octet-stream", });

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

    console.log("Token metadata prepared:", {
      ...tokenMetadata,
      file: "Blob data present",
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("Creating token...");
    const createResults = await sdk.createAndBuy(
      keypair,
      mint,
      tokenMetadata,
      BigInt(0.0001 * LAMPORTS_PER_SOL)
    );

    console.log("Token creation results:", createResults);

    if (!createResults.success) {
      throw new Error("Token creation returned false");
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
        error:
          error instanceof Error ? error.message : "Failed to create token",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log("Temporary file cleaned up");
      } catch (error) {
        console.error("Error cleaning up temporary file:", error);
      }
    }
  }
}
