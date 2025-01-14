"use client";

import React, { useState, useEffect } from "react";
import { Search } from 'lucide-react';
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
      <div className="flex justify-center items-center h-screen bg-[#ADB3A9]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700"></div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#ADB3A9] text-gray-800">
      <div className="w-[90vw] mx-auto px-4 py-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 font-sans">
            All Projects
          </h1>
          <p className="text-xl text-gray-600 mb-8 font-serif">
            Discover recently launched tokens
          </p>

          <div className="flex items-center justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 focus:outline-none bg-white rounded-lg text-gray-800 placeholder-gray-500 text-lg font-sans transition-all duration-300 ease-in-out"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tokens.map((token) => (
            <div
              key={token._id?.toString()}
              className="group relative rounded-lg bg-white shadow-md hover:shadow-lg p-6 transition-all duration-300 min-h-[300px] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-4">
                  <img
                    src={token.imageUrl}
                    alt={token.tokenName}
                    className="h-12 w-12 rounded-full bg-gray-200 object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2">
                      <h2 className="font-semibold leading-none truncate text-gray-900">
                        {token.tokenName}
                      </h2>
                      <h2 className="font-semibold leading-none truncate text-gray-600">
                        ${token.tokenSymbol}
                      </h2>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      Created by {publicKey?.toString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-gray-700 line-clamp-3">
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
                      className="text-gray-600 hover:text-gray-800 transition-colors"
                      aria-label="Twitter"
                    >
                      <div className="bg-gray-200 p-2 rounded-md hover:bg-gray-300 transition-colors">
                        <IconBrandX className="h-5 w-5" />
                      </div>
                    </a>
                  )}
                  {token.websiteLink && (
                    <a
                      href={token.websiteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-800 transition-colors"
                      aria-label="Website"
                    >
                      <div className="bg-gray-200 p-2 rounded-md hover:bg-gray-300 transition-colors">
                        <IconWorldWww className="h-5 w-5" />
                      </div>
                    </a>
                  )}
                  {token.telegramLink && (
                    <a
                      href={token.telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-800 transition-colors"
                      aria-label="Telegram"
                    >
                      <div className="bg-gray-200 p-2 rounded-md hover:bg-gray-300 transition-colors">
                        <IconBrandTelegram className="h-5 w-5" />
                      </div>
                    </a>
                  )}
                </div>
                <div className="w-full">
                  <div className="relative overflow-hidden rounded-md h-[7vh]">
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-900 to-black opacity-90"></div>
                    <div className="relative z-10 p-2 text-center">
                      <p className="text-white text-sm font-semibold">
                        This token is boosted {token.wallets.length}x  
                      </p>
                      <p className="text-white text-xs">
                        Every 10 minutes !!!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TokenList;