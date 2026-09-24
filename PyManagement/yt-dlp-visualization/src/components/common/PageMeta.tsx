import { HelmetProvider, Helmet } from "react-helmet-async";
import { TooltipProvider } from "@/components/ui/tooltip";

const HelmetC = Helmet as unknown as React.ComponentType<{
  title?: string;
  children?: React.ReactNode;
}>;
const HelmetProviderC = HelmetProvider as unknown as React.ComponentType<{
  children: React.ReactNode;
}>;

const PageMeta = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <HelmetC>
    <title>{title}</title>
    <meta name="description" content={description} />
  </HelmetC>
);

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProviderC>
    <TooltipProvider>
      {children}
    </TooltipProvider>
  </HelmetProviderC>
);

export default PageMeta;
