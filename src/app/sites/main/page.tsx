import Navbar from "@main/components/Navbar";
import Footer from "@main/components/Footer";
import ConfettiBackground from "@shared/background/ConfettiBackground";
import BlogPortal from "@main/components/BlogPortal";

export default function Home() {
  return (
    <div>
      <ConfettiBackground />
      <Navbar />
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center relative z-10 px-4">
          <BlogPortal />
        </main>
      </div>
      <Footer />
    </div>
  );
}
