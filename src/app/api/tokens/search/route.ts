import { NextResponse } from 'next/server';
import clientPromise from '@/utils/db';


export async function GET(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q');
      
      const client = await clientPromise;
      const db = client.db("tokenDb");
      
      const tokens = await db.collection('tokens').find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { symbol: { $regex: query, $options: 'i' } }
        ]
      }).toArray();
  
      return NextResponse.json({ success: true, data: tokens });
    } catch (error) {
      console.error('Failed to search tokens:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to search tokens' },
        { status: 500 }
      );
    }
  }