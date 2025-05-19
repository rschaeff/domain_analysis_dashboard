# Domain Analysis Dashboard

A NextJS/React dashboard for analyzing domain boundary predictions from the pyECOD pipeline.

## Features

- **Interactive Domain Visualization**: Compare putative domain boundaries with reference domains
- **Advanced Filtering**: Filter by protein, classification groups, confidence thresholds
- **Evidence Analysis**: View supporting evidence for domain assignments
- **Structure Integration**: Placeholder for Mol* 3D structure viewer
- **Sequence Analysis**: Placeholder for EBI Nightingale sequence annotation viewer
- **Manual Curation**: Tools for boundary editing and domain reassignment

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database with the pdb_analysis schema
- Domain partition data loaded into the database

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your database connection details
   ```

4. Initialize Prisma:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/          # Reusable UI components
├── lib/                # Utilities, types, database config
├── store/              # Zustand state stores
└── hooks/              # Custom React hooks
```

## Database Schema

The dashboard works with the following key tables in the `pdb_analysis` schema:

- `partition_proteins` - Proteins being analyzed
- `partition_domains` - Putative domain assignments
- `domain_evidence` - Supporting evidence for assignments
- `domain_comparisons` - Comparisons with reference domains

## Future Integrations

### Mol* Structure Viewer
- 3D protein structure visualization
- Domain boundary highlighting
- Interactive domain selection

### EBI Nightingale
- Sequence annotation viewer
- Integration with UniProt, Pfam
- Secondary structure display

### Manual Curation Tools
- Boundary editing interface
- Domain reassignment workflow
- Batch curation capabilities

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
