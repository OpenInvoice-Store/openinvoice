import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function CtaDocs() {
  return (
    <Button variant='ghost' asChild size='sm' className='group hidden sm:flex'>
      <a
        href='https://doc.openinvoice.store'
        rel='noopener noreferrer'
        target='_blank'
        className='dark:text-foreground transition-colors duration-300 hover:text-[#24292e] dark:hover:text-yellow-400'
      >
        <FileText className='transition-transform duration-300 group-hover:animate-bounce' />
      </a>
    </Button>
  );
}
