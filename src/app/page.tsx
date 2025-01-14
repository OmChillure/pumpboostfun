"use client";

import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { TokenData } from "@/types/token";
import {
  IconBrandTelegram,
  IconBrandX,
  IconWorldWww,
} from "@tabler/icons-react";
import { WalletInfo } from "@/lib/types";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";

const TokenList = () => {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const { publicKey, signTransaction, connected } = useWallet();

  const fetchTokens = async () => {
    try {
      const response = await fetch(
        `/api/tokens?search=${encodeURIComponent(search)}`
      );
      const data = await response.json();
      if (data.success) {
        setTokens(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch tokens:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [search]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="w-[90vw] mx-auto px-4 py-4 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">All Projects</h1>
        <p className="text-gray-400">All projects launched recently</p>

        <div className="flex items-center justify-center mt-6 mb-20">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 focus:outline-none bg-gray-800 rounded-md text-white placeholder-gray-400 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tokens.map((token) => (
          <div
            key={token._id}
            className="group relative rounded-lg bg-[#14151E] group hover:bg-[#1E1E29] p-6 transition-colors min-h-[270px] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-4">
                <img
                  src={token.imageUrl}
                  alt={token.tokenName}
                  className="h-12 w-12 rounded-full bg-gray-800 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2">
                    <h2 className="font-semibold leading-none truncate">
                      {token.tokenName}
                    </h2>
                    <h2 className="font-semibold leading-none truncate">
                      ${token.tokenSymbol}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 truncate">
                    Created by {publicKey?.toString()}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-400 line-clamp-3">
                  {token.tokenDescription || "No description available"}
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              <div className="flex gap-3">
                {token.twitterLink && (
                  <a
                    href={token.twitterLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                    aria-label="Twitter"
                  >
                    <div className="bg-black p-2 rounded-md">
                      <IconBrandX className="h-5 w-5" />
                    </div>
                  </a>
                )}
                {token.websiteLink && (
                  <a
                    href={token.websiteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                    aria-label="Website"
                  >
                    <div className="bg-black p-2 rounded-md">
                      <IconWorldWww className="h-5 w-5" />
                    </div>
                  </a>
                )}
                {token.telegramLink && (
                  <a
                    href={token.telegramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                    aria-label="Telegram"
                  >
                    <div className="bg-black p-2 rounded-md">
                      <IconBrandTelegram className="h-5 w-5" />
                    </div>
                  </a>
                )}
              </div>
              <div className="w-full">
                {token.wallets && token.wallets[0]?.tokenUrl && (
                  <Link 
                    href={token.wallets[0].tokenUrl} 
                    target="_blank"
                    className="block w-full"
                  >
                    <button className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                      View Token
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenList;