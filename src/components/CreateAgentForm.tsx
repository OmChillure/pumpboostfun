"use client";
import React, { useState, useRef } from "react";
import {
  Connection,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import type { WalletInfo, WalletGenerationProgress } from "@/lib/types";
import { Clock, DollarSign, Upload, ExternalLink, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { useWallet } from "@solana/wallet-adapter-react";

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
if (!RPC_URL) {
  throw new Error("NEXT_PUBLIC_HELIUS_RPC_URL environment variable is not set");
}

const AMOUNT_PER_WALLET = 0.035 * LAMPORTS_PER_SOL;
const MIN_DELAY = 5000;

const WalletGenerator = () => {
  const { publicKey, signTransaction, connected } = useWallet();
  const [walletCount, setWalletCount] = useState("");
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [error, setError] = useState<string>("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDesc, setTokenDesc] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [twitterLink, setTwitterLink] = useState("");
  const [websiteLink, setWebsiteLink] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [time, setTime] = useState("5000");
  const [progress, setProgress] = useState<WalletGenerationProgress>({
    current: 0,
    total: 0,
    status: "",
  });

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      setTime("");
      return;
    }

    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setTime(Math.max(numValue, MIN_DELAY).toString());
    }
  };

  const createToken = async (walletInfo: WalletInfo, file: File) => {
    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("tokenName", tokenName);
      formData.append("tokenSymbol", tokenSymbol);
      formData.append("tokenDescription", tokenDesc);

      const walletDataForAPI = {
        keypair: Array.from(walletInfo.keypair),
        mint: Array.from(walletInfo.mint),
        publicKey: walletInfo.publicKey,
      };

      formData.append("walletData", JSON.stringify(walletDataForAPI));

      if (twitterLink) formData.append("twitterLink", twitterLink);
      if (websiteLink) formData.append("websiteLink", websiteLink);
      if (telegramLink) formData.append("telegramLink", telegramLink);

      const response = await fetch("/api/create", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create token");
      }

      return result.tokenUrl;
    } catch (error) {
      console.error("Token creation error:", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!fileInputRef.current?.files?.[0]) {
      toast.error("Please select a token image");
      return;
    }

    if (!tokenName || !tokenSymbol) {
      toast.error("Please enter token name and symbol");
      return;
    }

    setError("");
    setStatus("");
    setWallets([]);
    setIsLoading(true);
    setProgress({ current: 0, total: 0, status: "Starting..." });

    let generatedWallets: WalletInfo[] = [];

    try {
      const count = parseInt(walletCount);
      if (isNaN(count) || count <= 0) {
        throw new Error("Please enter a valid positive number of wallets");
      }

      setProgress({ current: 0, total: count, status: "Initializing..." });
      const connection = new Connection(RPC_URL);

      const totalAmount = count * AMOUNT_PER_WALLET;
      const fundingWalletBalance = await connection.getBalance(publicKey);

      if (fundingWalletBalance < totalAmount) {
        throw new Error(
          `Insufficient balance. Required: ${
            totalAmount / LAMPORTS_PER_SOL
          } SOL`
        );
      }

      const transaction = new Transaction();
      const newWallets: WalletInfo[] = [];

      for (let i = 0; i < count; i++) {
        const newKeypair = Keypair.generate();
        const mintKeypair = Keypair.generate();

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: newKeypair.publicKey,
            lamports: AMOUNT_PER_WALLET,
          })
        );

        newWallets.push({
          name: `Wallet ${i + 1}`,
          publicKey: newKeypair.publicKey.toBase58(),
          balance: 0,
          keypair: Array.from(newKeypair.secretKey),
          mint: Array.from(mintKeypair.secretKey),
        });
      }

      setProgress((prev) => ({ ...prev, status: "Funding wallets..." }));

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(
        signed.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        }
      );

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      const delayTime = Math.max(parseInt(time) || MIN_DELAY, MIN_DELAY);
      await new Promise((resolve) => setTimeout(resolve, delayTime));

      for (let i = 0; i < newWallets.length; i++) {
        const wallet = newWallets[i];
        setProgress({
          current: i + 1,
          total: count,
          status: `Processing wallet ${i + 1}`,
        });

        try {
          const balance = await connection.getBalance(
            new PublicKey(wallet.publicKey)
          );
          wallet.balance = balance / LAMPORTS_PER_SOL;

          if (fileInputRef.current?.files?.[0]) {
            const tokenUrl = await createToken(
              wallet,
              fileInputRef.current.files[0]
            );
            wallet.tokenUrl = tokenUrl;
          }

          generatedWallets.push(wallet);
          setWallets([...generatedWallets]);

          toast.success(`Processed wallet ${i + 1}`);
        } catch (error) {
          console.error(`Error processing wallet ${i + 1}:`, error);
          toast.error(`Failed to process wallet ${i + 1}`);
        }
      }

      const tokenData = {
        tokenName,
        tokenSymbol,
        tokenDescription: tokenDesc,
        imageUrl: imagePreview,
        twitterLink,
        websiteLink,
        telegramLink,
        wallets: generatedWallets,
        launchInterval: parseInt(time) || MIN_DELAY,
        fundingWallet: publicKey.toString()
      };

      console.log("Storing token data:", tokenData);

      const storeResponse = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenData),
      });

      const storeResult = await storeResponse.json();
      if (!storeResult.success) {
        throw new Error("Failed to store token data");
      }

      toast.success("Token data stored successfully!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-[50rem] mx-auto space-y-6 font-lexend text-gray-800 p-8 rounded-lg">
      <div>
        <h1 className="text-4xl font-bold text-center mb-2">
          Launch Token
        </h1>
        <p className="text-xl text-gray-600 text-center">
          Create mutiple token in one go and let them market your product.
        </p>
      </div>
      <div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="tokenImage"
                className="text-[13px] font-lexend font-medium mb-2 sm:block hidden"
              >
                Token Image
              </label>
              <div className="flex justify-center">
                <div className="relative w-32 h-32">
                  <input
                    id="tokenImage"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                  <label
                    htmlFor="tokenImage"
                    className="flex items-center justify-center w-full h-full rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer overflow-hidden"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Token"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Upload className="w-8 h-8 " />
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="tokenName"
                  className="block text-sm font-medium"
                >
                  Token Name
                </label>
                <input
                  id="tokenName"
                  type="text"
                  placeholder="Enter token name"
                  className="w-full px-3 py-2 bg-white/90 rounded-[10px] border border-gray-400 h-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="tokenSymbol"
                  className="block text-sm font-medium"
                >
                  Token Symbol
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="tokenSymbol"
                    type="text"
                    placeholder="Enter token symbol"
                    className="w-full pl-10 pr-3 py-2 bg-white/90 rounded-[10px] border border-gray-400 h-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="tokenDesc" className="block text-sm font-medium">
                Token Description
              </label>
              <textarea
                id="tokenDesc"
                placeholder="Enter token description"
                className="w-full px-3 py-2 border rounded-md min-h-[100px] bg-white/90 border-gray-400 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                value={tokenDesc}
                onChange={(e) => setTokenDesc(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="walletCount"
                className="block text-sm font-medium"
              >
                Number of Wallets
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  id="walletCount"
                  type="number"
                  placeholder="Enter number of wallets"
                  className="w-full pl-10 pr-3 py-2 bg-white/90 rounded-[10px] border border-gray-400 h-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                  value={walletCount}
                  onChange={(e) => setWalletCount(e.target.value)}
                  min="1"
                />
              </div>
              <label
                htmlFor="walletCount"
                className="block text-sm font-medium "
              >
                Time Delay (milliseconds)
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  id="walletCount"
                  type="number"
                  placeholder="Enter the time for each token launch"
                  className="w-full pl-10 pr-3 py-2 bg-white/90 rounded-[10px] border border-gray-400 h-14 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  // onChange={handleTimeChange}
                  min={MIN_DELAY}
                />
              </div>{" "}
              <p className="text-sm text-gray-500 mt-1">
                Minimum delay: 5000ms (5 seconds)
              </p>
            </div>

            <div className="text-3xl">Socials</div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-[13px] font-lexend font-medium mb-2 block">
                  Twitter Link
                </label>
                <input
                  type="url"
                  placeholder="https://x.com/.."
                  value={twitterLink}
                  onChange={(e) => setTwitterLink(e.target.value)}
                  className="w-full bg-white/90 border border-gray-400 rounded-[10px] px-4 h-14 text-gray-800 placeholder-gray-500 font-medium font-roboto focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
              </div>

              <div>
                <label className="text-[13px] font-lexend font-medium mb-2 block">
                  Website Link
                </label>
                <input
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={websiteLink}
                  onChange={(e) => setWebsiteLink(e.target.value)}
                  className="w-full bg-white/90 border border-gray-400 rounded-[10px] px-4 h-14 text-gray-800 placeholder-gray-500 font-medium font-roboto focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
              </div>

              <div>
                <label className="text-[13px] font-lexend font-medium mb-2 block">
                  Telegram Link
                </label>
                <input
                  type="url"
                  placeholder="https://t.me/.."
                  value={telegramLink}
                  onChange={(e) => setTelegramLink(e.target.value)}
                  className="w-full bg-white/90 border border-gray-400 rounded-[10px] px-4 h-14 text-gray-800 placeholder-gray-500 font-medium font-roboto focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-800 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Launch Token"}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 rounded-md text-red-700">
            {error}
          </div>
        )}

        {progress.current > 0 && (
          <div className="mt-4 p-4 bg-blue-100 border border-blue-400 rounded-md text-blue-700">
            <p className="text-blue-600 dark:text-blue-400">
              Progress: {progress.current} / {progress.total} -{" "}
              {progress.status}
            </p>
          </div>
        )}

        {wallets.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-bold">Generated Wallets</h2>
            {wallets.map((wallet, index) => (
              <div
                key={wallet.publicKey}
                className="p-4 bg-white/90 rounded-lg border border-gray-400 shadow-sm"
              >
                <p className="font-semibold">{wallet.name}</p>
                <p className="font-mono text-sm break-all mt-1">
                  Public Key: {wallet.publicKey}
                </p>
                <p className="text-sm mt-1">Balance: {wallet.balance} SOL</p>
                {wallet.tokenUrl && (
                  <a
                    href={wallet.tokenUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline text-sm block mt-1"
                  >
                    View Token
                  </a>
                )}
                <div className="mt-2 text-sm">
                  <details>
                    <summary className="cursor-pointer text-blue-500">
                      Show Keys
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="font-mono break-all">
                        <span className="font-semibold">Keypair:</span>{" "}
                        {JSON.stringify(wallet.keypair)}
                      </p>
                      <p className="font-mono break-all">
                        <span className="font-semibold">Mint:</span>{" "}
                        {JSON.stringify(wallet.mint)}
                      </p>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-20" /> {/* Bottom spacing */}
    </div>
  );
};

export default WalletGenerator;
