import React, { useEffect, useState } from 'react';
import { useData } from '../state/DataContext';
import { Link } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';

function Items() {
  const { items, fetchItems } = useData();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const pageSize = 20;

  useEffect(() => {
    const controller = new AbortController();

    fetchItems({ page, pageSize, q: searchTerm }, controller.signal).catch(err => {
      if (err.name !== 'AbortError') console.error(err);
    });

    return () => controller.abort();
  }, [fetchItems, page, searchTerm]);

  if (!items.length) return <p>Loading...</p>;

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={e => {
          setSearchTerm(e.target.value);
          setPage(1);
        }}
        style={{ marginBottom: 8, padding: 4, width: '100%' }}
      />

      <List
        height={400}
        itemCount={items.length}
        itemSize={50}
        width="100%"
      >
        {({ index, style }) => {
          const item = items[index];
          return (
            <div style={{ ...style, display: 'flex', alignItems: 'center', paddingLeft: 8 }} key={item.id}>
              <Link to={'/items/' + item.id}>{item.name}</Link>
            </div>
          );
        }}
      </List>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page === 1}
          style={{ marginRight: 8 }}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          style={{ marginLeft: 8 }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Items;
