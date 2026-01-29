---
name: ERC721 NFT Metadata & Certificate Design
description: Best practices for creating beautiful on-chain/off-chain NFT metadata with dynamic SVG certificates for DeFi applications
tags: [solidity, nft, erc721, metadata, svg, defi]
version: 1.0
---

# ERC721 NFT Metadata & Certificate Design Skill

## 🎯 Purpose

This skill provides comprehensive guidance on designing and implementing ERC721 NFT metadata for DeFi savings certificates, including:
- Hybrid onchain/offchain metadata architecture  
- Dynamic SVG certificate generation
- JSON metadata standards (OpenSea compatible)
- Gas optimization strategies
- Beautiful visual design principles

## 📐 Architecture Principles

### 1. Hybrid Metadata Approach

**Onchain (Immutable, Critical Data):**
```solidity
// Store only essential data onchain
struct DepositCore {
    uint256 depositId;
    uint256 planId;
    address owner;
    uint256 principal;
    uint256 startTime;
    uint256 maturityTime;
    uint256 lockedApr;
    uint8 status;
}
```

**Offchain (Mutable, Rich Content):**
```json
{
  "name": "Savings Certificate #123",
  "description": "3-Month Savings Plan - 5% APR",
  "image": "https://api.example.com/nft/123/image",
  "animation_url": "https://api.example.com/nft/123/animation",
  "attributes": [...]
}
```

**Why Hybrid?**
- ✅ Gas efficiency: Offchain metadata = cheaper updates
- ✅ Flexibility: Can improve visuals without redeploy
- ✅ Rich content: Images, animations, detailed descriptions
- ✅ Trustless core: Critical data still onchain & verifiable

---

## 🎨 JSON Metadata Structure

### OpenSea Standard Format

```json
{
  "name": "Sổ Tiết Kiệm #123",
  "description": "Gói tiết kiệm 3 tháng với lãi suất 5%/năm. Ngày đáo hạn: 29/04/2026",
  "image": "https://api.savings.com/nft/123/image.svg",
  "animation_url": "https://api.savings.com/nft/123/animation.mp4",
  "external_url": "https://savings.com/deposits/123",
  
  "attributes": [
    {
      "trait_type": "Plan Name",
      "value": "Gói 3 Tháng"
    },
    {
      "trait_type": "Principal",
      "value": "1000",
      "display_type": "number"
    },
    {
      "trait_type": "Currency",
      "value": "USDC"
    },
    {
      "trait_type": "APR",
      "value": "5.00",
      "display_type": "percentage"
    },
    {
      "trait_type": "Duration",
      "value": "90",
      "display_type": "date",
      "max_value": 365
    },
    {
      "trait_type": "Progress",
      "value": 45,
      "display_type": "boost_percentage",
      "max_value": 100
    },
    {
      "trait_type": "Status",
      "value": "Active"
    },
    {
      "trait_type": "Maturity Date",
      "value": 1745884800,
      "display_type": "date"
    },
    {
      "trait_type": "Auto-Renew",
      "value": "Enabled"
    }
  ],
  
  "properties": {
    "category": "DeFi Savings",
    "certificate_number": "SV-2026-000123",
    "issuer": "DeFi Savings Protocol",
    "blockchain": "Ethereum",
    "standard": "ERC-721"
  }
}
```

### Attribute Display Types

| Display Type | Usage | Example |
|-------------|--------|---------|
| `number` | Numeric values | Principal amount |
| `percentage` | Percentage (auto adds %) | APR rate |
| `date` | Unix timestamp | Maturity date |
| `boost_number` | Progress bar (green) | Days completed |
| `boost_percentage` | Progress % (green) | Completion % |
| `default` | Plain text | Status, Plan name |

---

## 🖼️ SVG Certificate Design

### Design Principles

1. **Professional & Trustworthy**: Certificate should look official
2. **Dynamic Content**: Show real-time data (progress, days remaining)
3. **Beautiful Aesthetics**: Gradients, shadows, modern design
4. **Readable**: Clear fonts, good contrast
5. **Responsive**: Works at different sizes

### SVG Template Structure

```typescript
function generateCertificate(deposit: DepositData): string {
  const {
    depositId,
    planName,
    principal,
    apr,
    startDate,
    maturityDate,
    status,
    progress
  } = deposit;
  
  return `
    <svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
      <!-- Background Gradient -->
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
        
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="800" height="1000" fill="url(#bg)" />
      
      <!-- White Card -->
      <rect x="40" y="40" width="720" height="920" 
            fill="white" rx="20" filter="url(#shadow)" />
      
      <!-- Header -->
      <text x="400" y="120" text-anchor="middle" 
            font-size="48" font-weight="bold" fill="#1f2937">
        Savings Certificate
      </text>
      
      <text x="400" y="160" text-anchor="middle" 
            font-size="24" fill="#6b7280">
        #${depositId}
      </text>
      
      <!-- Divider Line -->
      <line x1="80" y1="200" x2="720" y2="200" 
            stroke="#e5e7eb" stroke-width="2"/>
      
      <!-- Details Section -->
      ${renderDetails(deposit)}
      
      <!-- Progress Bar -->
      ${renderProgressBar(progress)}
      
      <!-- Status Badge -->
      ${renderStatusBadge(status)}
      
      <!-- Footer -->
      <text x="400" y="950" text-anchor="middle" 
            font-size="16" fill="#9ca3af">
        DeFi Savings Protocol • Powered by Ethereum
      </text>
    </svg>
  `;
}
```

### Color Palette Recommendations

```css
/* Primary Colors */
--primary-gradient-start: #667eea;
--primary-gradient-end: #764ba2;

/* Status Colors */
--status-active: #10b981;      /* Green */
--status-matured: #3b82f6;     /* Blue */
--status-withdrawn: #6b7280;   /* Gray */
--status-early: #f59e0b;       /* Orange */
--status-renewed: #8b5cf6;     /* Purple */

/* Text Colors */
--text-primary: #1f2937;
--text-secondary: #6b7280;
--text-light: #9ca3af;

/* Background */
--bg-white: #ffffff;
--bg-gray: #f9fafb;
```

---

## 🔧 Implementation Patterns

### Pattern 1: Fully Offchain Metadata

**Use when:** Metadata needs frequent updates, complex graphics

```solidity
contract NFTRegistry is ERC721 {
    string private _baseTokenURI;
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        
        // Return API endpoint
        return string(abi.encodePacked(
            _baseTokenURI,
            tokenId.toString(),
            "/metadata"
        ));
        // Example: https://api.savings.com/nft/123/metadata
    }
    
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }
}
```

**API Endpoint:**
```typescript
app.get('/nft/:tokenId/metadata', async (req, res) => {
  const { tokenId } = req.params;
  
  // 1. Get onchain data
  const depositData = await contract.getDeposit(tokenId);
  const planData = await contract.getPlan(depositData.planId);
  
  // 2. Get offchain metadata
  const planMetadata = await fetchFromIPFS(planData.metadataHash);
  
  // 3. Generate dynamic metadata
  const metadata = {
    name: `Savings Certificate #${tokenId}`,
    description: `${planMetadata.name} - ${formatAPR(depositData.apr)}% APR`,
    image: `${BASE_URL}/nft/${tokenId}/image`,
    attributes: generateAttributes(depositData, planMetadata)
  };
  
  res.json(metadata);
});
```

---

### Pattern 2: Data URI Onchain

**Use when:** Want fully trustless metadata, simple graphics

```solidity
contract NFTRegistry is ERC721 {
    ISavingsBank public savingsBank;
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // Get data from storage contract
        (
            uint256 planId,
            uint256 principal,
            uint256 startTime,
            uint256 maturityTime,
            uint256 apr,
            ,
            uint8 status
        ) = savingsBank.getDepositDetails(tokenId);
        
        string memory planName = savingsBank.getPlanName(planId);
        
        // Generate SVG
        string memory svg = generateSVG(tokenId, planName, principal, apr, status);
        
        // Generate JSON
        string memory json = string(abi.encodePacked(
            '{',
            '"name":"Savings Certificate #', tokenId.toString(), '",',
            '"description":"', planName, '",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"',
            '}'
        ));
        
        // Return Data URI
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }
    
    function generateSVG(...) internal pure returns (string memory) {
        // Generate SVG string
        return string(abi.encodePacked(
            '<svg width="400" height="600">',
            // ... SVG content
            '</svg>'
        ));
    }
}
```

---

### Pattern 3: Hybrid (Recommended)

**Best of both worlds: Critical data onchain, rich content offchain**

```solidity
contract NFTRegistry is ERC721 {
    string private _baseTokenURI;
    mapping(uint256 => bytes32) public onchainDataHash;
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // Return offchain endpoint with onchain hash for verification
        return string(abi.encodePacked(
            _baseTokenURI,
            tokenId.toString(),
            "?hash=",
            toHexString(onchainDataHash[tokenId])
        ));
    }
    
    function updateDataHash(uint256 tokenId) external {
        // Recalculate hash when deposit state changes
        onchainDataHash[tokenId] = calculateDepositHash(tokenId);
    }
}
```

**Verification on Frontend:**
```typescript
// Verify metadata matches onchain state
const metadata = await fetch(tokenURI).then(r => r.json());
const onchainHash = await contract.onchainDataHash(tokenId);
const calculatedHash = hashDepositData(metadata.onchain_data);

if (onchainHash !== calculatedHash) {
  console.warn("Metadata may be stale or tampered!");
}
```

---

## 🚀 API Implementation Example

### Express.js Metadata Server

```typescript
import express from 'express';
import { ethers } from 'ethers';
import sharp from 'sharp';

const app = express();
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Generate NFT metadata
app.get('/nft/:tokenId/metadata', async (req, res) => {
  const { tokenId } = req.params;
  
  try {
    // Get onchain data
    const deposit = await contract.getDepositDetails(tokenId);
    const plan = await contract.getPlan(deposit.planId);
    const planName = await contract.getPlanName(deposit.planId);
    
    // Calculate dynamic values
    const now = Date.now() / 1000;
    const elapsed = now - deposit.startTime;
    const duration = deposit.maturityTime - deposit.startTime;
    const progress = Math.min(100, (elapsed / duration) * 100);
    const daysRemaining = Math.max(0, (deposit.maturityTime - now) / 86400);
    
    // Generate metadata
    const metadata = {
      name: `Savings Certificate #${tokenId}`,
      description: `${planName} - ${formatAPR(deposit.apr)}% APR`,
      image: `${BASE_URL}/nft/${tokenId}/image.svg`,
      animation_url: `${BASE_URL}/nft/${tokenId}/animation.mp4`,
      external_url: `${FRONTEND_URL}/deposits/${tokenId}`,
      
      attributes: [
        { trait_type: "Plan", value: planName },
        { trait_type: "Principal", value: formatUSDC(deposit.principal), display_type: "number" },
        { trait_type: "APR", value: formatAPR(deposit.apr), display_type: "percentage" },
        { trait_type: "Progress", value: Math.floor(progress), display_type: "boost_percentage" },
        { trait_type: "Days Remaining", value: Math.floor(daysRemaining), display_type: "number" },
        { trait_type: "Status", value: getStatusText(deposit.status) },
        { trait_type: "Maturity Date", value: deposit.maturityTime, display_type: "date" }
      ],
      
      properties: {
        onchain_deposit_id: tokenId.toString(),
        certificate_number: `SV-${new Date().getFullYear()}-${tokenId.toString().padStart(6, '0')}`
      }
    };
    
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate dynamic SVG image
app.get('/nft/:tokenId/image.svg', async (req, res) => {
  const { tokenId } = req.params;
  
  const deposit = await contract.getDepositDetails(tokenId);
  const planName = await contract.getPlanName(deposit.planId);
  
  const svg = generateCertificateSVG({
    depositId: tokenId,
    planName,
    principal: deposit.principal,
    apr: deposit.apr,
    startTime: deposit.startTime,
    maturityTime: deposit.maturityTime,
    status: deposit.status
  });
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

app.listen(3000);
```

---

## 📚 Best Practices

### 1. Gas Optimization

```solidity
// ❌ BAD: Store entire SVG onchain
string public svg = "<svg>...</svg>"; // Expensive!

// ✅ GOOD: Generate dynamically or use offchain
function tokenURI(uint256 tokenId) external view returns (string memory) {
    return string(abi.encodePacked(baseURI, tokenId.toString()));
}
```

### 2. Caching Strategy

```typescript
// Cache metadata for 5 minutes
app.get('/nft/:tokenId/metadata', cache('5 minutes'), async (req, res) => {
  // ...
});

// Invalidate cache on state change
contract.on("DepositStatusChanged", (depositId) => {
  cache.del(`/nft/${depositId}/metadata`);
});
```

### 3. Fallback Mechanisms

```solidity
// Provide fallback if API is down
function tokenURI(uint256 tokenId) public view override returns (string memory) {
    // Try offchain first
    if (bytes(_baseTokenURI).length > 0) {
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString()));
    }
    
    // Fallback to simple onchain version
    return generateSimpleDataURI(tokenId);
}
```

---

## 🔍 Testing Checklist

- [ ] Metadata renders correctly on OpenSea
- [ ] Metadata renders correctly on Rarible  
- [ ] Metadata renders correctly on LooksRare
- [ ] SVG displays in all modern browsers
- [ ] Attributes show correct display types
- [ ] Progress bar updates in real-time
- [ ] API handles high load (load testing)
- [ ] Fallback works if API is down
- [ ] Metadata cache invalidates properly
- [ ] Gas costs are reasonable

---

## 📖 References

- [OpenSea Metadata Standards](https://docs.opensea.io/docs/metadata-standards)
- [ERC721 Specification](https://eips.ethereum.org/EIPS/eip-721)
- [SVG Tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial)
- [Base64 Encoding in Solidity](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Base64.sol)

---

**Version:** 1.0  
**Last Updated:** 2026-01-29  
**Maintained by:** DeFi Savings Protocol Team
